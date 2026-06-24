from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from proxytrace.agent_demo.workflow import JiraTriageWorkflow
from proxytrace.replay.agent_harness import InterceptedReplayRuntime
from proxytrace.replay.firewall import SideEffectFirewall


def _step(index: int, step_type: str, payload: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(
        step_id=f"step-{index}",
        run_id="run-1",
        step_index=index,
        step_type=step_type,
        payload=payload,
        snapshot={},
    )


def _recorded_steps() -> list[SimpleNamespace]:
    return [
        _step(
            1,
            "llm",
            {
                "messages": [{"role": "user", "content": "old prompt"}],
                "response": {
                    "next_tool": "get_project_key",
                    "candidate_board": "INFRA",
                    "reason": "Database incident.",
                },
            },
        ),
        _step(
            2,
            "tool",
            {
                "tool_name": "get_project_key",
                "params": {
                    "issue_key": "DEMO-1",
                    "summary": "Database incident",
                    "description": "Latency is high",
                },
                "response": {"project_key": "INFRA"},
            },
        ),
        _step(
            3,
            "llm",
            {
                "messages": [{"role": "user", "content": "old final prompt"}],
                "response": {
                    "next_tool": "update_ticket",
                    "board": "INFRA",
                    "reason": "Validated lookup.",
                },
            },
        ),
        _step(
            4,
            "tool",
            {
                "tool_name": "update_ticket",
                "params": {
                    "issue_key": "DEMO-1",
                    "board": "INFRA",
                    "reason": "Validated lookup.",
                },
                "response": {
                    "updated": True,
                    "issue_key": "DEMO-1",
                    "board": "INFRA",
                    "status": "recorded",
                },
            },
        ),
    ]


def _legacy_recorded_steps() -> list[SimpleNamespace]:
    steps = _recorded_steps()
    steps[0].payload["response"] = {
        "candidates": [{"content": {"parts": [{"text": ""}]}}]
    }
    steps[2].payload["response"] = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Move this ticket to the validated board."}]
                }
            }
        ]
    }
    steps[1].snapshot = {"candidate_board": "INFRA"}
    return steps


async def _contract(tool_name: str) -> SimpleNamespace:
    write = tool_name == "update_ticket"
    return SimpleNamespace(
        tool_type="write" if write else "read",
        side_effect=write,
        replay_policy="mock_only" if write else "mock_from_recording",
        requires_approval=write,
    )


class FakeGenerator:
    calls = 0

    async def generate(self, **_: Any) -> dict[str, Any]:
        self.calls += 1
        return {
            "next_tool": "update_ticket",
            "board": "PLATFORM",
            "reason": "Patched lookup changed the route.",
        }


class EscalationRuntime:
    def __init__(self) -> None:
        self.tool_calls: list[tuple[str, dict[str, Any]]] = []

    async def decide(self, *, stage: str, **_: Any) -> dict[str, Any]:
        if stage == "initial_triage":
            return {
                "next_tool": "get_project_key",
                "candidate_board": "SECURITY",
                "reason": "Authentication outage.",
            }
        return {
            "next_tool": "escalate_ticket",
            "board": "SECURITY",
            "priority": "Highest",
            "reason": "All users are locked out.",
        }

    async def call_tool(
        self,
        *,
        tool_name: str,
        params: dict[str, Any],
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        self.tool_calls.append((tool_name, params))
        if tool_name == "get_project_key":
            return {"response": {"project_key": "SECURITY", "confidence": 1.0}}
        return {"response": {"updated": True, "priority": params["priority"]}}


async def test_strict_runtime_executes_current_workflow_with_zero_live_calls() -> None:
    runtime = InterceptedReplayRuntime(
        recorded_steps=_recorded_steps(),
        contract_resolver=_contract,
        firewall=SideEffectFirewall(),
        mode="strict",
    )

    result = await JiraTriageWorkflow().execute(
        runtime,
        issue_key="DEMO-1",
        summary="Database incident",
        description="Latency is high",
    )

    assert result["final_board"] == "INFRA"
    assert [event["actual_signature"] for event in runtime.events] == [
        ("llm", None),
        ("tool", "get_project_key"),
        ("llm", None),
        ("tool", "update_ticket"),
    ]
    assert runtime.live_model_call_count == 0
    assert runtime.live_tool_call_count == 0
    assert runtime.side_effect_block_count == 1


async def test_exploratory_runtime_executes_downstream_decision_after_patch() -> None:
    generator = FakeGenerator()
    runtime = InterceptedReplayRuntime(
        recorded_steps=_recorded_steps(),
        contract_resolver=_contract,
        firewall=SideEffectFirewall(),
        mode="exploratory",
        patch_step=2,
        patch_payload={
            "patch_type": "tool_result_patch",
            "value": {"response": {"project_key": "PLATFORM"}},
        },
        decision_generator=generator,
    )

    result = await JiraTriageWorkflow().execute(
        runtime,
        issue_key="DEMO-1",
        summary="Database incident",
        description="Latency is high",
    )

    assert generator.calls == 1
    assert result["final_board"] == "PLATFORM"
    update = runtime.events[-1]
    assert update["payload"]["params"]["board"] == "PLATFORM"
    assert update["source"] == "simulated_tool_interceptor"
    assert update["firewall"]["allowed"] is False


async def test_strict_runtime_recovers_legacy_decisions_from_recorded_boundaries() -> None:
    runtime = InterceptedReplayRuntime(
        recorded_steps=_legacy_recorded_steps(),
        contract_resolver=_contract,
        firewall=SideEffectFirewall(),
        mode="strict",
    )

    result = await JiraTriageWorkflow().execute(
        runtime,
        issue_key="DEMO-1",
        summary="Database incident",
        description="Latency is high",
    )

    assert result["final_board"] == "INFRA"
    assert [event["source"] for event in runtime.events] == [
        "recorded_boundary_recovery",
        "recorded_interceptor",
        "recorded_boundary_recovery",
        "recorded_interceptor",
    ]
    assert runtime.live_model_call_count == 0
    assert runtime.side_effect_block_count == 1


async def test_exploratory_runtime_recovers_legacy_initial_decision() -> None:
    generator = FakeGenerator()
    runtime = InterceptedReplayRuntime(
        recorded_steps=_legacy_recorded_steps(),
        contract_resolver=_contract,
        firewall=SideEffectFirewall(),
        mode="exploratory",
        patch_step=2,
        patch_payload={
            "patch_type": "tool_result_patch",
            "value": {"response": {"project_key": "PLATFORM"}},
        },
        decision_generator=generator,
    )

    result = await JiraTriageWorkflow().execute(
        runtime,
        issue_key="DEMO-1",
        summary="Database incident",
        description="Latency is high",
    )

    assert result["final_board"] == "PLATFORM"
    assert runtime.events[0]["source"] == "recorded_boundary_recovery"
    assert generator.calls == 1


async def test_workflow_takes_real_escalation_branch_for_high_impact_issue() -> None:
    runtime = EscalationRuntime()

    result = await JiraTriageWorkflow().execute(
        runtime,
        issue_key="SAFE-1",
        summary="Authentication outage",
        description="All users are locked out.",
    )

    assert result["final_decision"]["next_tool"] == "escalate_ticket"
    assert runtime.tool_calls[-1] == (
        "escalate_ticket",
        {
            "issue_key": "SAFE-1",
            "board": "SECURITY",
            "priority": "Highest",
            "reason": "All users are locked out.",
        },
    )
