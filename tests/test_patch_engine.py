from __future__ import annotations

from types import SimpleNamespace

from proxytrace.evaluator.divergence_diff import DivergenceDiff
from proxytrace.evaluator.ai_scorer import GeminiScorer
from proxytrace.evaluator.hybrid_evaluator import HybridEvaluator
from proxytrace.patch.patch_engine import PatchEngine


def step(index: int, step_type: str, payload: dict, snapshot: dict | None = None):
    return SimpleNamespace(
        step_id=f"step-{index}",
        run_id="run-1",
        step_index=index,
        step_type=step_type,
        payload=payload,
        snapshot=snapshot or {},
    )


def sample_steps():
    return [
        step(1, "llm", {"response": {"next_tool": "get_project_key"}}),
        step(
            2,
            "tool",
            {
                "tool_name": "get_project_key",
                "params": {"issue_key": "DEMO-1"},
                "response": {"project_key": "INFRA", "confidence": 0.62},
            },
        ),
        step(3, "llm", {"response": {"next_tool": "update_ticket", "board": "INFRA"}}),
        step(
            4,
            "tool",
            {
                "tool_name": "update_ticket",
                "params": {"issue_key": "DEMO-1", "board": "INFRA"},
                "response": {"updated": True, "issue_key": "DEMO-1", "board": "INFRA"},
            },
        ),
    ]


def test_patch_engine_does_not_fabricate_downstream_propagation() -> None:
    result = PatchEngine().apply(
        sample_steps(),
        patch_step=2,
        patch_payload={
            "patch_type": "tool_result_patch",
            "value": {"response": {"project_key": "PLATFORM", "confidence": 0.94}},
        },
    )

    update_step = result["patched_steps"][3]
    assert result["propagation"]["strategy"] == "agent_reexecution_required"
    assert result["propagation"]["applied"] is False
    assert update_step["payload"]["params"]["board"] == "INFRA"
    assert update_step["payload"]["response"]["board"] == "INFRA"
    assert update_step["unverified"] is False


def test_divergence_diff_reports_final_state_change() -> None:
    steps = sample_steps()
    patch_result = PatchEngine().apply(
        steps,
        patch_step=2,
        patch_payload={
            "patch_type": "tool_result_patch",
            "value": {"response": {"project_key": "PLATFORM"}},
        },
    )

    diff = DivergenceDiff().compare(steps, patch_result["patched_steps"])

    assert diff["trajectory_diff"]["changed_step_count"] == 1
    assert diff["semantic_outcome_diff"]["changed"] is False
    assert diff["semantic_outcome_diff"]["original_final_state"]["board"] == "INFRA"
    assert diff["semantic_outcome_diff"]["patched_final_state"]["board"] == "INFRA"


async def test_hybrid_evaluator_fallback_does_not_impersonate_ai_verdict() -> None:
    steps = sample_steps()
    patch_payload = {
        "patch_type": "tool_result_patch",
        "value": {"response": {"project_key": "PLATFORM"}},
    }
    patch_result = PatchEngine().apply(
        steps,
        patch_step=2,
        patch_payload=patch_payload,
    )
    diff = DivergenceDiff().compare(steps, patch_result["patched_steps"])

    verdict = await HybridEvaluator(scorer=GeminiScorer(enabled=False)).evaluate(
        patch_step=2,
        patch_payload=patch_payload,
        diff=diff,
    )

    assert "root_cause_step" not in verdict
    assert "divergence_type" not in verdict
    assert "risk_level" not in verdict
    assert "recommendation" not in verdict
    assert verdict["judge_confidence"] == 0.0
    assert verdict["human_review_required"] is True
    assert verdict["source"] == "gemini_scorer_fallback"
    assert verdict["semantic_judgment"]["source"] == "semantic_outcome_judge_fallback"
    assert verdict["ai_load_bearing"] is False
    assert verdict["deterministic_evidence"]["source"] == "deterministic_diff_only"
