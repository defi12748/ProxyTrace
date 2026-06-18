from __future__ import annotations

from types import SimpleNamespace

from proxytrace.regression_pack.pack_store import build_assertions_from_replay
from proxytrace.regression_pack.runner import RegressionRunner


def exploratory_replay():
    return SimpleNamespace(
        replay_id="replay-1",
        run_id="run-1",
        mode="exploratory",
        patch_step=2,
        patch_payload={
            "patch_type": "tool_result_patch",
            "value": {"response": {"project_key": "PLATFORM"}},
        },
        verdict={
            "patched_steps": [
                {"step_index": 1, "step_type": "llm", "payload": {}},
                {
                    "step_index": 2,
                    "step_type": "tool",
                    "tool_name": "get_project_key",
                    "payload": {"response": {"project_key": "PLATFORM"}},
                },
                {
                    "step_index": 4,
                    "step_type": "tool",
                    "tool_name": "update_ticket",
                    "payload": {
                        "params": {"issue_key": "DEMO-1", "board": "PLATFORM"},
                        "response": {
                            "updated": True,
                            "issue_key": "DEMO-1",
                            "board": "PLATFORM",
                            "status": "mocked_local_demo",
                        },
                    },
                },
            ],
            "diff": {
                "semantic_outcome_diff": {
                    "patched_final_state": {
                        "issue_key": "DEMO-1",
                        "board": "PLATFORM",
                        "updated": True,
                        "status": "mocked_local_demo",
                    }
                }
            },
            "evaluation": {
                "risk_level": "high",
                "semantic_judgment": {
                    "assertions": {
                        "expected_final_state": {
                            "issue_key": "DEMO-1",
                            "board": "PLATFORM",
                            "updated": True,
                        },
                        "expected_final_board": "PLATFORM",
                        "satisfies_expected_outcome": True,
                        "source": "ai_semantic_outcome",
                    }
                },
            },
        },
    )


def test_build_assertions_from_exploratory_replay() -> None:
    assertions = build_assertions_from_replay(exploratory_replay())

    assert assertions["source_replay_id"] == "replay-1"
    assert assertions["expected_tool_sequence"] == [
        {"step_index": 2, "tool_name": "get_project_key"},
        {"step_index": 4, "tool_name": "update_ticket"},
    ]
    assert assertions["expected_final_board"] == "PLATFORM"
    assert assertions["ai_semantic_assertions"]["source"] == "ai_semantic_outcome"
    assert assertions["frozen_trace"][2]["payload"]["response"]["board"] == "PLATFORM"


def test_regression_runner_checks_frozen_assertions() -> None:
    assertions = build_assertions_from_replay(exploratory_replay())

    result = RegressionRunner()._evaluate_assertions(assertions)

    assert result["passed"] is True
    assert result["failures"] == []
    assert result["actual_final_state"]["board"] == "PLATFORM"
