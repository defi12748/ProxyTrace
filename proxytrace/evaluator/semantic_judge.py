from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from proxytrace.settings import get_settings


try:
    from google import genai
except ImportError:  # pragma: no cover - exercised in environments without google-genai.
    genai = None  # type: ignore[assignment]


class SemanticOutcomeOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_final_state: dict[str, Any] = Field(default_factory=dict)
    expected_final_board: str | None = None
    satisfies_expected_outcome: bool
    evidence: list[str] = Field(default_factory=list)
    judge_confidence: float = Field(ge=0.0, le=1.0)


class SemanticOutcomeJudge:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        enabled: bool = True,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self.model = model or settings.gemini_model
        self.enabled = enabled

    def judge(
        self,
        *,
        trace_context: dict[str, Any],
        diff: dict[str, Any],
    ) -> dict[str, Any]:
        if not self.enabled:
            return self._fallback("semantic_judge_disabled")
        if not self.api_key:
            return self._fallback("missing_gemini_api_key")
        if genai is None:
            return self._fallback("missing_google_genai_dependency")
        if not trace_context:
            return self._fallback("missing_trace_context")

        try:
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model,
                contents=self._prompt(
                    trace_context=trace_context,
                    diff=diff,
                ),
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0,
                },
            )
            raw_text = getattr(response, "text", "") or ""
            parsed = SemanticOutcomeOutput.model_validate(json.loads(raw_text))
        except (json.JSONDecodeError, ValidationError, Exception) as exc:
            return self._fallback(f"{type(exc).__name__}: {exc}")

        verdict = parsed.model_dump(mode="json")
        verdict["human_review_required"] = verdict["judge_confidence"] < 0.7
        verdict["source"] = "gemini_semantic_outcome_judge"
        verdict["model"] = self.model
        verdict["assertions"] = {
            "expected_final_state": verdict["expected_final_state"],
            "expected_final_board": verdict.get("expected_final_board"),
            "satisfies_expected_outcome": verdict["satisfies_expected_outcome"],
            "evidence": verdict["evidence"],
            "source": "ai_semantic_outcome",
        }
        return verdict

    def _prompt(
        self,
        *,
        trace_context: dict[str, Any],
        diff: dict[str, Any],
    ) -> str:
        payload = {
            "instruction": (
                "Infer the intended business outcome of a Jira triage agent run from "
                "the original ticket context and trace. Decide whether the patched "
                "final state satisfies that intended outcome. Return JSON only."
            ),
            "output_schema": {
                "expected_final_state": "object, e.g. issue_key/board/updated/status",
                "expected_final_board": "string or null",
                "satisfies_expected_outcome": "boolean",
                "evidence": "string[] with concrete trace/ticket evidence",
                "judge_confidence": "float 0..1",
            },
            "rules": [
                "Use ticket semantics, not keyword matching alone.",
                "If evidence is incomplete, use confidence below 0.7.",
                "Do not invent tools or fields that are absent from the trace.",
                "Return JSON only. No markdown.",
            ],
            "trace_context": trace_context,
            "diff": diff,
        }
        return json.dumps(payload, sort_keys=True, default=str)

    def _fallback(self, reason: str) -> dict[str, Any]:
        return {
            "expected_final_state": {},
            "expected_final_board": None,
            "satisfies_expected_outcome": False,
            "evidence": [],
            "judge_confidence": 0.0,
            "human_review_required": True,
            "source": "semantic_outcome_judge_fallback",
            "fallback_reason": reason,
            "model": self.model,
            "assertions": {},
        }
