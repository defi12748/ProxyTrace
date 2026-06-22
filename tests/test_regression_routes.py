from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from proxytrace.db.session import get_session
from proxytrace.proxy.routes import regression


def _client(session: object) -> TestClient:
    app = FastAPI()
    app.include_router(regression.router)

    async def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    return TestClient(app)


def test_run_single_regression() -> None:
    item = SimpleNamespace(test_id="test-1")
    session = SimpleNamespace(commit=AsyncMock())
    test_runner = SimpleNamespace(
        run_item=AsyncMock(
            return_value={"test_id": "test-1", "passed": True, "failures": []}
        )
    )

    with patch.object(
        regression,
        "get_regression_item",
        new=AsyncMock(return_value=item),
    ), patch.object(regression, "runner", test_runner):
        response = _client(session).post("/regression/test-1/run")

    assert response.status_code == 200
    assert response.json()["passed"] == 1
    test_runner.run_item.assert_awaited_once_with(
        session,
        item,
        candidate_trace=None,
    )
    session.commit.assert_awaited_once()


def test_run_single_regression_returns_404() -> None:
    with patch.object(
        regression,
        "get_regression_item",
        new=AsyncMock(return_value=None),
    ):
        response = _client(SimpleNamespace()).post("/regression/missing/run")

    assert response.status_code == 404
