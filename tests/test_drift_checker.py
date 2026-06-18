"""Tests for proxytrace.drift.checker – full coverage of all three drift kinds."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from proxytrace.contracts.schema_hasher import hash_schema, hash_json
from proxytrace.drift.checker import DriftChecker, DriftKind
from proxytrace.proxy.mcp_proxy import ToolProxyGateway
from proxytrace.schemas import ToolCallRequest


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

_TOOL_NAME = "get_project_key"

_CANONICAL_INPUT = {
    "issue_key": "DEMO-1",
    "summary": "Something",
    "description": "Desc.",
}
_CANONICAL_OUTPUT = {
    "project_key": "PLATFORM",
    "confidence": 0.92,
    "evidence": ["platform"],
}

_INPUT_HASH = hash_schema(_CANONICAL_INPUT)
_OUTPUT_HASH = hash_schema(_CANONICAL_OUTPUT)

# Build descriptor hash the same way registry.build_contract does
_DESCRIPTOR_MATERIAL: dict[str, Any] = {
    "version": "v1",
    "tool_type": "read",
    "side_effect": False,
    "requires_approval": False,
    "replay_policy": "mock_from_recording",
    "trust_level": "trusted_internal",
    "input_schema": hash_schema(_CANONICAL_INPUT),
    "output_schema": hash_schema(_CANONICAL_OUTPUT),
}
_DESCRIPTOR_HASH = hash_json(_DESCRIPTOR_MATERIAL)


def _make_contract(
    *,
    input_hash: str = _INPUT_HASH,
    output_hash: str = _OUTPUT_HASH,
    descriptor_hash: str = _DESCRIPTOR_HASH,
) -> MagicMock:
    contract = MagicMock()
    contract.input_schema_hash = input_hash
    contract.output_schema_hash = output_hash
    contract.descriptor_hash = descriptor_hash
    return contract


def _make_step(
    *,
    step_type: str = "tool",
    tool_name: str = _TOOL_NAME,
    params: dict[str, Any] | None = None,
    response: Any | None = None,
    snapshot_descriptor_hash: str | None = None,
    step_id: str = "step-abc",
    step_index: int = 2,
) -> SimpleNamespace:
    payload: dict[str, Any] = {"tool_name": tool_name}
    if params is not None:
        payload["params"] = params
    if response is not None:
        payload["response"] = response

    snapshot: dict[str, Any] = {}
    if snapshot_descriptor_hash is not None:
        snapshot["contract_descriptor_hash"] = snapshot_descriptor_hash

    return SimpleNamespace(
        step_id=step_id,
        step_index=step_index,
        step_type=step_type,
        run_id="run-xyz",
        payload=payload,
        snapshot=snapshot,
    )


async def _run_check(step: SimpleNamespace, contract: MagicMock):
    checker = DriftChecker()
    session = AsyncMock()

    with patch(
        "proxytrace.drift.checker.get_contract_or_default",
        new=AsyncMock(return_value=contract),
    ), patch(
        "proxytrace.drift.checker.log_drift_warning",
        new=AsyncMock(return_value=None),
    ):
        return await checker.check_step(session, step=step, run_id="run-xyz")


# --------------------------------------------------------------------------- #
# Non-tool steps are skipped                                                   #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_llm_step_skipped() -> None:
    step = _make_step(step_type="llm")
    result = await _run_check(step, _make_contract())
    assert not result.drifted
    assert result.findings == []


# --------------------------------------------------------------------------- #
# Clean (no drift) path                                                        #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_no_drift_when_schemas_match() -> None:
    step = _make_step(
        params=_CANONICAL_INPUT,
        response=_CANONICAL_OUTPUT,
        snapshot_descriptor_hash=_DESCRIPTOR_HASH,
    )
    result = await _run_check(step, _make_contract())
    assert not result.drifted
    assert result.findings == []


# --------------------------------------------------------------------------- #
# Input schema drift                                                           #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_input_schema_drift_detected() -> None:
    # Add an extra field – changes the shape
    drifted_input = {**_CANONICAL_INPUT, "new_field": 42}
    step = _make_step(params=drifted_input, response=_CANONICAL_OUTPUT)
    result = await _run_check(step, _make_contract())

    assert result.drifted
    kinds = [f.kind for f in result.findings]
    assert DriftKind.INPUT_SCHEMA in kinds


@pytest.mark.asyncio
async def test_input_schema_drift_finding_has_correct_hashes() -> None:
    drifted_input = {**_CANONICAL_INPUT, "extra": "yes"}
    step = _make_step(params=drifted_input)
    result = await _run_check(step, _make_contract())

    finding = next(f for f in result.findings if f.kind == DriftKind.INPUT_SCHEMA)
    assert finding.old_hash == _INPUT_HASH
    assert finding.new_hash == hash_schema(drifted_input)
    assert finding.tool_name == _TOOL_NAME


@pytest.mark.asyncio
async def test_input_schema_no_drift_when_values_differ_but_shape_same() -> None:
    """Different values, same shape → no drift."""
    same_shape_input = {
        "issue_key": "OTHER-99",
        "summary": "Different",
        "description": "Also different.",
    }
    step = _make_step(params=same_shape_input, response=_CANONICAL_OUTPUT)
    result = await _run_check(step, _make_contract())
    assert DriftKind.INPUT_SCHEMA not in [f.kind for f in result.findings]


# --------------------------------------------------------------------------- #
# Output schema drift                                                          #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_output_schema_drift_detected() -> None:
    # Remove a field – changes the shape
    drifted_output = {"project_key": "PLATFORM"}
    step = _make_step(params=_CANONICAL_INPUT, response=drifted_output)
    result = await _run_check(step, _make_contract())

    assert result.drifted
    assert DriftKind.OUTPUT_SCHEMA in [f.kind for f in result.findings]


@pytest.mark.asyncio
async def test_output_schema_drift_finding_has_correct_hashes() -> None:
    drifted_output = {"project_key": "PLATFORM", "new_flag": True}
    step = _make_step(response=drifted_output)
    result = await _run_check(step, _make_contract())

    finding = next(f for f in result.findings if f.kind == DriftKind.OUTPUT_SCHEMA)
    assert finding.old_hash == _OUTPUT_HASH
    assert finding.new_hash == hash_schema(drifted_output)


@pytest.mark.asyncio
async def test_output_schema_not_checked_when_response_absent() -> None:
    """Steps without a ``response`` key must not raise or produce output drift."""
    step = _make_step(params=_CANONICAL_INPUT)  # no response
    result = await _run_check(step, _make_contract())
    assert DriftKind.OUTPUT_SCHEMA not in [f.kind for f in result.findings]


# --------------------------------------------------------------------------- #
# Descriptor drift                                                              #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_descriptor_drift_detected() -> None:
    # Step was recorded with a different descriptor hash
    old_hash = "sha256:" + "a" * 64
    step = _make_step(snapshot_descriptor_hash=old_hash)
    result = await _run_check(step, _make_contract())

    assert result.drifted
    assert DriftKind.DESCRIPTOR in [f.kind for f in result.findings]


@pytest.mark.asyncio
async def test_descriptor_drift_finding_has_correct_hashes() -> None:
    old_hash = "sha256:" + "b" * 64
    step = _make_step(snapshot_descriptor_hash=old_hash)
    result = await _run_check(step, _make_contract())

    finding = next(f for f in result.findings if f.kind == DriftKind.DESCRIPTOR)
    assert finding.old_hash == old_hash
    assert finding.new_hash == _DESCRIPTOR_HASH


@pytest.mark.asyncio
async def test_descriptor_check_skipped_when_no_snapshot_hash() -> None:
    """Backwards-compatible: steps without snapshot hash should not fail."""
    step = _make_step(snapshot_descriptor_hash=None)
    result = await _run_check(step, _make_contract())
    assert DriftKind.DESCRIPTOR not in [f.kind for f in result.findings]


# --------------------------------------------------------------------------- #
# Multiple simultaneous drift findings                                         #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_all_three_drifts_at_once() -> None:
    drifted_input = {**_CANONICAL_INPUT, "extra": 1}
    drifted_output = {"project_key": "PLATFORM"}
    old_descriptor = "sha256:" + "c" * 64

    step = _make_step(
        params=drifted_input,
        response=drifted_output,
        snapshot_descriptor_hash=old_descriptor,
    )
    result = await _run_check(step, _make_contract())

    assert result.drifted
    kinds = {f.kind for f in result.findings}
    assert kinds == {DriftKind.INPUT_SCHEMA, DriftKind.OUTPUT_SCHEMA, DriftKind.DESCRIPTOR}


# --------------------------------------------------------------------------- #
# log_drift_warning is called for each finding                                 #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_log_drift_warning_called_per_finding() -> None:
    drifted_input = {**_CANONICAL_INPUT, "extra": True}
    step = _make_step(params=drifted_input)
    checker = DriftChecker()
    session = AsyncMock()

    with patch(
        "proxytrace.drift.checker.get_contract_or_default",
        new=AsyncMock(return_value=_make_contract()),
    ), patch(
        "proxytrace.drift.checker.log_drift_warning",
        new=AsyncMock(return_value=None),
    ) as mock_log:
        result = await checker.check_step(session, step=step, run_id="run-xyz")

    assert mock_log.call_count == len(result.findings)
    assert mock_log.call_count >= 1


# --------------------------------------------------------------------------- #
# Step with no tool_name is handled gracefully                                 #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_empty_tool_name_returns_no_drift() -> None:
    step = _make_step(tool_name="")
    step.payload = {}  # no tool_name key at all
    checker = DriftChecker()
    session = AsyncMock()

    with patch(
        "proxytrace.drift.checker.get_contract_or_default",
        new=AsyncMock(return_value=_make_contract()),
    ), patch(
        "proxytrace.drift.checker.log_drift_warning",
        new=AsyncMock(return_value=None),
    ):
        result = await checker.check_step(session, step=step, run_id="run-xyz")

    assert not result.drifted


# --------------------------------------------------------------------------- #
# MCP gateway automatic drift checks                                           #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_mcp_gateway_runs_drift_check_after_recording_tool_step() -> None:
    contract = SimpleNamespace(
        tool_name="get_project_key",
        version="v1",
        tool_type="read",
        input_schema_hash=_INPUT_HASH,
        output_schema_hash=_OUTPUT_HASH,
        descriptor_hash=_DESCRIPTOR_HASH,
        side_effect=False,
        requires_approval=False,
        replay_policy="mock_from_recording",
        trust_level="trusted_internal",
    )
    step = SimpleNamespace(
        step_id="step-123",
        run_id="run-123",
        step_index=2,
        step_type="tool",
        payload={},
        snapshot={},
        recorded_at=None,
    )
    drift_checker = SimpleNamespace(
        check_step=AsyncMock(
            return_value=SimpleNamespace(
                tool_name="get_project_key",
                step_id="step-123",
                drifted=False,
                findings=[],
            )
        )
    )

    class FakeGateway(ToolProxyGateway):
        async def _execute_tool(self, tool_name: str, params: dict[str, Any]) -> Any:
            assert tool_name == "get_project_key"
            return _CANONICAL_OUTPUT

    request = ToolCallRequest(
        run_id="run-123",
        tool_name="get_project_key",
        params=_CANONICAL_INPUT,
        step_index=2,
    )
    session = AsyncMock()

    with patch(
        "proxytrace.proxy.mcp_proxy.get_contract_or_default",
        new=AsyncMock(return_value=contract),
    ), patch(
        "proxytrace.proxy.mcp_proxy.record_step",
        new=AsyncMock(return_value=step),
    ) as mock_record_step:
        response = await FakeGateway(drift_checker=drift_checker).record_and_execute(
            session,
            request,
        )

    drift_checker.check_step.assert_awaited_once_with(
        session,
        step=step,
        run_id="run-123",
    )
    recorded_snapshot = mock_record_step.await_args.kwargs["snapshot"]
    assert recorded_snapshot["contract_descriptor_hash"] == _DESCRIPTOR_HASH
    assert response["drift"] == {
        "checked": True,
        "tool_name": "get_project_key",
        "step_id": "step-123",
        "drifted": False,
        "finding_count": 0,
        "findings": [],
    }
