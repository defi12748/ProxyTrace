from __future__ import annotations

import json
from typing import Any

from proxytrace.evaluator.ai_scorer import GeminiScorer
from proxytrace.evaluator.semantic_judge import SemanticOutcomeJudge


class FakeResponse:
    def __init__(self, text: str) -> None:
        self.text = text


class FakeModels:
    def __init__(self, text: str) -> None:
        self.text = text

    def generate_content(self, *args: Any, **kwargs: Any) -> FakeResponse:
        return FakeResponse(self.text)


class FakeClient:
    def __init__(self, text: str) -> None:
        self.models = FakeModels(text)


def test_gemini_scorer_parses_strict_json(monkeypatch) -> None:
    payload = {
        "root_cause_step": 2,
        "divergence_type": "wrong_argument",
        "affected_steps": [4],
        "risk_level": "high",
        "recommendation": "Validate project keys before updating Jira tickets.",
        "judge_confidence": 0.91,
    }

    class FakeGenAI:
        @staticmethod
        def Client(api_key: str) -> FakeClient:
            return FakeClient(json.dumps(payload))

    monkeypatch.setattr("proxytrace.evaluator.ai_scorer.genai", FakeGenAI)

    verdict = GeminiScorer(api_key="fake", model="gemini-test").score(
        patch_step=2,
        patch_payload={"patch_type": "tool_result_patch"},
        diff={},
    )

    assert verdict["judge_confidence"] == 0.91
    assert verdict["human_review_required"] is False
    assert verdict["source"] == "gemini_structured_scorer"
    assert verdict["model"] == "gemini-test"


def test_gemini_scorer_falls_back_on_malformed_output(monkeypatch) -> None:
    class FakeGenAI:
        @staticmethod
        def Client(api_key: str) -> FakeClient:
            return FakeClient("not json")

    monkeypatch.setattr("proxytrace.evaluator.ai_scorer.genai", FakeGenAI)

    verdict = GeminiScorer(api_key="fake", model="gemini-test").score(
        patch_step=2,
        patch_payload={"patch_type": "tool_result_patch"},
        diff={},
    )

    assert verdict["judge_confidence"] == 0.0
    assert verdict["human_review_required"] is True
    assert verdict["source"] == "gemini_scorer_fallback"
    assert "fallback_reason" in verdict


def test_semantic_outcome_judge_parses_assertions(monkeypatch) -> None:
    payload = {
        "expected_final_state": {
            "issue_key": "DEMO-1",
            "board": "PLATFORM",
            "updated": True,
        },
        "expected_final_board": "PLATFORM",
        "satisfies_expected_outcome": True,
        "evidence": ["Ticket describes API deploy pipeline failure."],
        "judge_confidence": 0.93,
    }

    class FakeGenAI:
        @staticmethod
        def Client(api_key: str) -> FakeClient:
            return FakeClient(json.dumps(payload))

    monkeypatch.setattr("proxytrace.evaluator.semantic_judge.genai", FakeGenAI)

    verdict = SemanticOutcomeJudge(api_key="fake", model="gemini-test").judge(
        trace_context={"run": {"metadata": {"summary": "API deploy pipeline fails"}}},
        diff={},
    )

    assert verdict["source"] == "gemini_semantic_outcome_judge"
    assert verdict["human_review_required"] is False
    assert verdict["assertions"]["expected_final_board"] == "PLATFORM"
    assert verdict["assertions"]["satisfies_expected_outcome"] is True


def test_semantic_outcome_judge_falls_back_on_malformed_output(monkeypatch) -> None:
    class FakeGenAI:
        @staticmethod
        def Client(api_key: str) -> FakeClient:
            return FakeClient("not json")

    monkeypatch.setattr("proxytrace.evaluator.semantic_judge.genai", FakeGenAI)

    verdict = SemanticOutcomeJudge(api_key="fake", model="gemini-test").judge(
        trace_context={"run": {"metadata": {"summary": "API deploy pipeline fails"}}},
        diff={},
    )

    assert verdict["source"] == "semantic_outcome_judge_fallback"
    assert verdict["human_review_required"] is True
    assert verdict["assertions"] == {}
