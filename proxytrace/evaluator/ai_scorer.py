from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from proxytrace.settings import get_settings


try:
    from google import genai
except ImportError:  # pragma: no cover - exercised in environments without google-genai.
    genai = None  # type: ignore[assignment]


DivergenceType = Literal[
    "wrong_argument",
    "wrong_tool",
    "wrong_order",
    "hallucinated_value",
    "schema_violation",
]
RiskLevel = Literal["low", "medium", "high", "critical"]


class ScorerOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    root_cause_step: int
    divergence_type: DivergenceType
    affected_steps: list[int] = Field(default_factory=list)
    risk_level: RiskLevel
    recommendation: str
    judge_confidence: float = Field(ge=0.0, le=1.0)


class GeminiScorer:
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

    def score(
        self,
        *,
        patch_step: int,
        patch_payload: dict[str, Any],
        diff: dict[str, Any],
        deterministic_verdict: dict[str, Any],
    ) -> dict[str, Any]:
        if not self.enabled:
            return self._fallback(
                reason="scorer_disabled",
                deterministic_verdict=deterministic_verdict,
            )
        if not self.api_key:
            return self._fallback(
                reason="missing_gemini_api_key",
                deterministic_verdict=deterministic_verdict,
            )
        if genai is None:
            return self._fallback(
                reason="missing_google_genai_dependency",
                deterministic_verdict=deterministic_verdict,
            )

        try:
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model,
                contents=self._prompt(
                    patch_step=patch_step,
                    patch_payload=patch_payload,
                    diff=diff,
                    deterministic_verdict=deterministic_verdict,
                ),
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0,
                },
            )
            raw_text = getattr(response, "text", "") or ""
            data = json.loads(raw_text)
            parsed = ScorerOutput.model_validate(data)
        except (json.JSONDecodeError, ValidationError, Exception) as exc:
            return self._fallback(
                reason=f"{type(exc).__name__}: {exc}",
                deterministic_verdict=deterministic_verdict,
            )

        verdict = parsed.model_dump(mode="json")
        verdict["human_review_required"] = verdict["judge_confidence"] < 0.7
        verdict["source"] = "gemini_structured_scorer"
        verdict["model"] = self.model
        return verdict

    def _prompt(
        self,
        *,
        patch_step: int,
        patch_payload: dict[str, Any],
        diff: dict[str, Any],
        deterministic_verdict: dict[str, Any],
    ) -> str:
        payload = {
            "instruction": (
                "Compare an original AI-agent trajectory to a patched exploratory "
                "trajectory. Deterministic checks are the source of truth; you only "
                "explain root cause, affected steps, risk, and one concrete fix."
            ),
            "output_schema": {
                "root_cause_step": "integer",
                "divergence_type": [
                    "wrong_argument",
                    "wrong_tool",
                    "wrong_order",
                    "hallucinated_value",
                    "schema_violation",
                ],
                "affected_steps": "integer[]",
                "risk_level": ["low", "medium", "high", "critical"],
                "recommendation": "string",
                "judge_confidence": "float 0..1",
            },
            "rules": [
                "Return JSON only. No markdown.",
                "Prefer deterministic_verdict values unless the diff contradicts them.",
                "Use low confidence below 0.7 when the evidence is incomplete.",
                "Keep recommendation to one concrete sentence.",
            ],
            "patch_step": patch_step,
            "patch_payload": patch_payload,
            "deterministic_verdict": deterministic_verdict,
            "diff": diff,
        }
        return json.dumps(payload, sort_keys=True, default=str)

    def _fallback(
        self,
        *,
        reason: str,
        deterministic_verdict: dict[str, Any],
    ) -> dict[str, Any]:
        verdict = dict(deterministic_verdict)
        verdict["judge_confidence"] = 0.0
        verdict["human_review_required"] = True
        verdict["source"] = "gemini_scorer_fallback"
        verdict["fallback_reason"] = reason
        verdict["model"] = self.model
        return verdict
