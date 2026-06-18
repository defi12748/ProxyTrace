from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.contracts.schema_hasher import hash_json
from proxytrace.db.repository import record_step, step_to_dict
from proxytrace.privacy.redaction import redact_sensitive_data, redaction_metadata
from proxytrace.settings import get_settings


async def record_llm_snapshot(
    session: AsyncSession,
    *,
    run_id: str,
    model: str,
    system_prompt: str,
    messages: list[dict[str, Any]],
    response: Any,
    token_usage: dict[str, Any] | None = None,
    step_index: int | None = None,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    redaction_enabled = settings.redaction_enabled
    safe_system_prompt = redact_sensitive_data(
        system_prompt,
        enabled=redaction_enabled,
    )
    safe_messages = redact_sensitive_data(messages, enabled=redaction_enabled)
    safe_response = redact_sensitive_data(response, enabled=redaction_enabled)
    safe_snapshot = redact_sensitive_data(
        snapshot or {"messages": messages},
        enabled=redaction_enabled,
    )
    prompt_material = {
        "system_prompt": safe_system_prompt,
        "messages": safe_messages,
        "model": model,
    }
    payload = {
        "model": model,
        "system_prompt": safe_system_prompt,
        "messages": safe_messages,
        "response": safe_response,
        "token_usage": token_usage or {},
        "prompt_hash": hash_json(prompt_material),
        "response_hash": hash_json(safe_response),
        "status": "ok",
        "redaction": redaction_metadata(redaction_enabled),
    }
    step = await record_step(
        session,
        run_id=run_id,
        step_type="llm",
        payload=payload,
        snapshot=safe_snapshot,
        step_index=step_index,
    )
    return step_to_dict(step)


def decide_project_board(summary: str, description: str = "") -> dict[str, Any]:
    """Deterministic demo decision used when no real LLM key is configured."""
    text = f"{summary} {description}".lower()
    evidence: list[str] = []
    board = "TRIAGE"

    rules = [
        ("PLATFORM", ["api", "deploy", "platform", "release", "pipeline"]),
        ("INFRA", ["database", "latency", "network", "server", "infra"]),
        ("SECURITY", ["auth", "token", "permission", "oauth", "security"]),
        ("BILLING", ["invoice", "payment", "billing", "subscription"]),
    ]
    for candidate, keywords in rules:
        hits = [keyword for keyword in keywords if keyword in text]
        if hits:
            board = candidate
            evidence = hits[:3]
            break

    confidence = 0.93 if evidence else 0.54
    return {
        "intent": "route_ticket",
        "board": board,
        "confidence": confidence,
        "evidence": evidence,
    }
