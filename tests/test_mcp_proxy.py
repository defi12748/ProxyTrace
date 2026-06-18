from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from proxytrace.contracts.registry import DEFAULT_TOOL_DESCRIPTORS, build_contract
from proxytrace.contracts.schema_hasher import hash_schema
from proxytrace.drift.checker import DriftKind
from proxytrace.proxy.demo_tools import get_project_key, update_ticket
from proxytrace.proxy.mcp_proxy import ToolProxyGateway
from proxytrace.schemas import ToolCallRequest


def _contract() -> SimpleNamespace:
    return SimpleNamespace(
        tool_name="get_project_key",
        version="v1",
        tool_type="read",
        input_schema_hash="sha256:input",
        output_schema_hash="sha256:output",
        descriptor_hash="sha256:descriptor",
        side_effect=False,
        requires_approval=False,
        replay_policy="mock_from_recording",
        trust_level="trusted_internal",
    )


async def test_mcp_proxy_embeds_descriptor_hash_and_runs_drift_check() -> None:
    step = SimpleNamespace(
        step_id="step-1",
        run_id="run-1",
        step_index=2,
        step_type="tool",
        payload={},
        snapshot={},
        recorded_at=None,
    )
    finding = SimpleNamespace(
        kind=DriftKind.INPUT_SCHEMA,
        old_hash="sha256:old",
        new_hash="sha256:new",
        detail="input drift",
    )
    drift = SimpleNamespace(
        tool_name="get_project_key",
        step_id="step-1",
        drifted=True,
        findings=[finding],
    )
    checker = SimpleNamespace(check_step=AsyncMock(return_value=drift))
    gateway = ToolProxyGateway(drift_checker=checker)
    gateway._execute_tool = AsyncMock(  # type: ignore[method-assign]
        return_value={
            "project_key": "PLATFORM",
            "confidence": 0.91,
            "evidence": ["api"],
            "source": "demo_tool",
        }
    )

    with patch(
        "proxytrace.proxy.mcp_proxy.get_contract_or_default",
        new=AsyncMock(return_value=_contract()),
    ), patch(
        "proxytrace.proxy.mcp_proxy.record_step",
        new=AsyncMock(return_value=step),
    ) as record_step:
        result = await gateway.record_and_execute(
            AsyncMock(),
            ToolCallRequest(
                run_id="run-1",
                tool_name="get_project_key",
                params={
                    "issue_key": "DEMO-1",
                    "summary": "API deploy pipeline fails",
                    "description": "Pipeline fails after API change.",
                },
                snapshot={"candidate_board": "PLATFORM"},
            ),
        )

    snapshot = record_step.await_args.kwargs["snapshot"]
    assert snapshot["contract_descriptor_hash"] == "sha256:descriptor"
    checker.check_step.assert_awaited_once_with(
        record_step.await_args.args[0],
        step=step,
        run_id="run-1",
    )
    assert result["drift"]["checked"] is True
    assert result["drift"]["drifted"] is True
    assert result["drift"]["finding_count"] == 1
    assert result["drift"]["findings"][0]["kind"] == "input_schema_drift"


async def test_default_contracts_match_demo_tool_response_shapes() -> None:
    project_contract = build_contract(
        "get_project_key",
        DEFAULT_TOOL_DESCRIPTORS["get_project_key"],
    )
    update_contract = build_contract(
        "update_ticket",
        DEFAULT_TOOL_DESCRIPTORS["update_ticket"],
    )

    project_response = await get_project_key(
        {
            "issue_key": "DEMO-1",
            "summary": "API deploy pipeline fails",
            "description": "Pipeline fails after API change.",
        }
    )
    update_response = await update_ticket(
        {
            "issue_key": "DEMO-1",
            "board": "PLATFORM",
            "reason": "The incident affects platform deployment.",
        }
    )

    assert hash_schema(project_response) == project_contract.output_schema_hash
    assert hash_schema(update_response) == update_contract.output_schema_hash
