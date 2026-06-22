from __future__ import annotations

from dataclasses import dataclass
import secrets

from fastapi import Header, HTTPException, Request, status

from proxytrace.settings import get_settings


@dataclass(frozen=True)
class APIContext:
    workspace_id: str
    authenticated: bool


async def require_api_context(
    request: Request,
    authorization: str | None = Header(default=None),
    x_proxytrace_api_key: str | None = Header(default=None),
    x_proxytrace_workspace_id: str | None = Header(default=None),
) -> APIContext:
    settings = get_settings()
    expected = settings.proxytrace_api_key
    provided = x_proxytrace_api_key or _bearer_token(authorization)

    if settings.auth_required:
        if not expected:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AUTH_REQUIRED is enabled but PROXYTRACE_API_KEY is not configured",
            )
        if not provided or not secrets.compare_digest(provided, expected):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid or missing ProxyTrace API credential",
                headers={"WWW-Authenticate": "Bearer"},
            )

    authenticated = bool(settings.auth_required and expected and provided)
    # Authenticated callers are pinned to the server-side workspace and cannot
    # select a tenant with a request header. The header exists only for local,
    # explicitly unauthenticated development.
    workspace_id = (
        settings.proxytrace_workspace_id
        if authenticated or settings.auth_required
        else (x_proxytrace_workspace_id or settings.proxytrace_workspace_id)
    )
    context = APIContext(workspace_id=workspace_id, authenticated=authenticated)
    request.state.proxytrace_context = context
    return context


def _bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token.strip()
