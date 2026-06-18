from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv


load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalize_asyncpg_query(url: str) -> str:
    if "sslmode=" not in url and "channel_binding=" not in url:
        return url
    parts = urlsplit(url)
    params = dict(parse_qsl(parts.query, keep_blank_values=True))
    sslmode = params.pop("sslmode", None)
    params.pop("channel_binding", None)
    if sslmode and "ssl" not in params:
        params["ssl"] = "require" if sslmode == "require" else sslmode
    return urlunsplit(parts._replace(query=urlencode(params)))


@dataclass(frozen=True)
class Settings:
    app_name: str = "ProxyTrace"
    database_url: str = os.getenv("DATABASE_URL", "")
    proxytrace_api_url: str = os.getenv("PROXYTRACE_API_URL", "http://127.0.0.1:8000")
    tool_upstream_base_url: str | None = os.getenv("TOOL_UPSTREAM_BASE_URL") or None
    demo_tool_mode: bool = _as_bool(os.getenv("DEMO_TOOL_MODE"), default=True)
    tool_timeout_seconds: float = float(os.getenv("TOOL_TIMEOUT_SECONDS", "20"))
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    redaction_enabled: bool = _as_bool(os.getenv("REDACTION_ENABLED"), default=True)
    atlassian_site_url: str = os.getenv("ATLASSIAN_SITE_URL", "")
    atlassian_email: str = os.getenv("ATLASSIAN_EMAIL", "")
    atlassian_api_token: str = os.getenv("ATLASSIAN_API_TOKEN", "")
    atlassian_project_key: str = os.getenv("ATLASSIAN_PROJECT_KEY", "")

    @property
    def atlassian_configured(self) -> bool:
        return bool(
            self.atlassian_site_url
            and self.atlassian_email
            and self.atlassian_api_token
        )

    @property
    def async_database_url(self) -> str:
        """Normalize common DATABASE_URL formats for SQLAlchemy async drivers."""
        url = self.database_url
        if not url:
            raise RuntimeError(
                "DATABASE_URL is required. Use the Neon pooled PostgreSQL URL "
                "with sslmode=require."
            )
        if url.startswith("postgresql+asyncpg://"):
            return _normalize_asyncpg_query(url)
        if url.startswith("postgresql://"):
            async_url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return _normalize_asyncpg_query(async_url)
        if url.startswith("postgres://"):
            async_url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            return _normalize_asyncpg_query(async_url)
        return url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
