from __future__ import annotations

from proxytrace.privacy.redaction import REDACTION_TOKEN, redact_sensitive_data


def test_redaction_masks_emails_and_secret_like_values() -> None:
    payload = {
        "description": "Contact owner@example.com with Bearer abcdefghijklmnop.",
        "api_token": "ATATTsupersecrettokenvalue",
        "nested": [{"note": "Google key AIza123456789012345678"}],
    }

    redacted = redact_sensitive_data(payload)

    assert "owner@example.com" not in redacted["description"]
    assert "Bearer abcdefghijklmnop" not in redacted["description"]
    assert redacted["api_token"] == REDACTION_TOKEN
    assert redacted["nested"][0]["note"] == f"Google key {REDACTION_TOKEN}"


def test_redaction_can_be_disabled() -> None:
    payload = {"email": "owner@example.com"}

    assert redact_sensitive_data(payload, enabled=False) == payload


def test_redaction_converts_tuples_to_json_lists() -> None:
    assert redact_sensitive_data(("owner@example.com",)) == [REDACTION_TOKEN]
