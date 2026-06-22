from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.contracts.schema_hasher import hash_json
from proxytrace.db.repository import record_step, step_to_dict
from proxytrace.privacy.redaction import redact_sensitive_data, redaction_metadata
from proxytrace.settings import get_settings


def _response_text(response: Any) -> str | None:
    if isinstance(response, dict):
        if isinstance(response.get("text"), str):
            return response["text"]
        candidates = response.get("candidates")
        if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict):
            content = candidates[0].get("content") or {}
            parts = content.get("parts") or [] if isinstance(content, dict) else []
            if parts and isinstance(parts[0], dict) and isinstance(parts[0].get("text"), str):
                return parts[0]["text"]
    text = getattr(response, "text", None)
    return text if isinstance(text, str) else None


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
        "response_text": _response_text(safe_response),
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
