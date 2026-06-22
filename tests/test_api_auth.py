from __future__ import annotations

from types import SimpleNamespace

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from proxytrace.proxy import auth
from proxytrace.proxy.auth import APIContext


def _app() -> FastAPI:
    app = FastAPI()

    @app.get("/private")
    async def private(
        context: APIContext = Depends(auth.require_api_context),
    ) -> dict[str, object]:
        return {
            "workspace_id": context.workspace_id,
            "authenticated": context.authenticated,
        }

    return app


def test_api_key_auth_pins_caller_to_server_workspace(monkeypatch) -> None:
    monkeypatch.setattr(
        auth,
        "get_settings",
        lambda: SimpleNamespace(
            auth_required=True,
            proxytrace_api_key="secret-key",
            proxytrace_workspace_id="tenant-a",
        ),
    )
    client = TestClient(_app())

    unauthorized = client.get("/private")
    authorized = client.get(
        "/private",
        headers={
            "Authorization": "Bearer secret-key",
            "X-ProxyTrace-Workspace-ID": "tenant-b",
        },
    )

    assert unauthorized.status_code == 401
    assert authorized.status_code == 200
    assert authorized.json() == {
        "workspace_id": "tenant-a",
        "authenticated": True,
    }


def test_auth_required_fails_closed_without_server_credential(monkeypatch) -> None:
    monkeypatch.setattr(
        auth,
        "get_settings",
        lambda: SimpleNamespace(
            auth_required=True,
            proxytrace_api_key="",
            proxytrace_workspace_id="tenant-a",
        ),
    )

    response = TestClient(_app()).get("/private")

    assert response.status_code == 503
