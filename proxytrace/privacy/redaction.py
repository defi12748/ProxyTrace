from __future__ import annotations

import re
from typing import Any


REDACTION_TOKEN = "[REDACTED]"
POLICY_NAME = "pii_and_secret_patterns_v1"

_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_BEARER_RE = re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b", re.IGNORECASE)
_SECRET_VALUE_RE = re.compile(
    r"\b(?:sk|ghp|xox[baprs]|ATATT|AIza)[A-Za-z0-9_\-]{12,}\b"
)
_SECRET_KEY_PARTS = (
    "api_key",
    "apikey",
    "authorization",
    "bearer",
    "client_secret",
    "password",
    "secret",
    "token",
)


def redaction_metadata(enabled: bool = True) -> dict[str, Any]:
    return {
        "enabled": enabled,
        "policy": POLICY_NAME if enabled else "disabled",
    }


def redact_sensitive_data(value: Any, *, enabled: bool = True) -> Any:
    if not enabled:
        return value
    return _redact(value)


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            key_text = str(key)
            if _is_secret_key(key_text):
                redacted[key_text] = REDACTION_TOKEN
            else:
                redacted[key_text] = _redact(item)
        return redacted
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if isinstance(value, tuple):
        return [_redact(item) for item in value]
    if isinstance(value, str):
        return _redact_string(value)
    return value


def _is_secret_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(part in normalized for part in _SECRET_KEY_PARTS)


def _redact_string(value: str) -> str:
    redacted = _EMAIL_RE.sub(REDACTION_TOKEN, value)
    redacted = _BEARER_RE.sub(REDACTION_TOKEN, redacted)
    redacted = _SECRET_VALUE_RE.sub(REDACTION_TOKEN, redacted)
    return redacted
