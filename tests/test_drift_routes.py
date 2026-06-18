from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from proxytrace.db.session import get_session
from proxytrace.drift.checker import DriftCheckResult, DriftFinding, DriftKind
from proxytrace.proxy.routes import drift


def _client(session: object) -> TestClient:
    app = FastAPI()
    app.include_router(drift.router)

    async def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    return TestClient(app)


def _step(step_id: str = "step-1", run_id: str = "run-1"):
    return SimpleNamespace(
        step_id=step_id,
        run_id=run_id,
        step_index=2,
        step_type="tool",
        payload={"tool_name": "get_project_key"},
        snapshot={},
    )


def _finding() -> DriftFinding:
    return DriftFinding(
        kind=DriftKind.INPUT_SCHEMA,
        tool_name="get_project_key",
        step_id="step-1",
        old_hash="sha256:old",
        new_hash="sha256:new",
        detail="Input schema changed.",
    )


def test_drift_check_endpoint_checks_single_step() -> None:
    session = SimpleNamespace(
        get=AsyncMock(return_value=_step()),
        commit=AsyncMock(),
    )
    checker = SimpleNamespace(
        check_step=AsyncMock(
            return_value=DriftCheckResult(
                tool_name="get_project_key",
                step_id="step-1",
                drifted=True,
                findings=[_finding()],
            )
        )
    )

    with patch.object(drift, "_checker", checker):
        response = _client(session).post("/drift/check", json={"step_id": "step-1"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["drifted"] is True
    assert payload["findings"][0]["kind"] == "input_schema_drift"
    checker.check_step.assert_awaited_once()
    session.commit.assert_awaited_once()


def test_drift_check_all_endpoint_checks_tool_steps() -> None:
    steps = [_step("step-1"), _step("step-2")]
    result = SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: steps),
    )
    session = SimpleNamespace(
        execute=AsyncMock(return_value=result),
        commit=AsyncMock(),
    )
    checker = SimpleNamespace(
        check_step=AsyncMock(
            return_value=DriftCheckResult(
                tool_name="get_project_key",
                step_id="step-1",
                drifted=False,
                findings=[],
            )
        )
    )

    with patch.object(drift, "_checker", checker), patch(
        "proxytrace.proxy.routes.drift.get_run",
        new=AsyncMock(return_value=SimpleNamespace(run_id="run-1")),
    ):
        response = _client(session).post("/runs/run-1/drift/check-all")

    assert response.status_code == 200
    payload = response.json()
    assert payload["steps_checked"] == 2
    assert payload["all_clear"] is True
    assert checker.check_step.await_count == 2
    session.commit.assert_awaited_once()


def test_drift_listing_endpoint_filters_to_drift_warnings() -> None:
    warning = SimpleNamespace(
        warning_id="warn-1",
        run_id="run-1",
        step_id="step-1",
        warning_type="input_schema_drift",
        old_hash="sha256:old",
        new_hash="sha256:new",
        surfaced_at=datetime(2026, 6, 18),
        details="Input schema changed.",
    )
    non_drift_warning = SimpleNamespace(
        warning_id="warn-2",
        run_id="run-1",
        step_id="step-2",
        warning_type="side_effect_blocked",
        old_hash=None,
        new_hash=None,
        surfaced_at=datetime(2026, 6, 18),
        details="Blocked write during replay.",
    )

    with patch(
        "proxytrace.proxy.routes.drift.get_run",
        new=AsyncMock(return_value=SimpleNamespace(run_id="run-1")),
    ), patch(
        "proxytrace.proxy.routes.drift.list_warnings",
        new=AsyncMock(return_value=[warning, non_drift_warning]),
    ):
        response = _client(SimpleNamespace()).get("/runs/run-1/drift")

    assert response.status_code == 200
    payload = response.json()
    assert payload["drift_warning_count"] == 1
    assert payload["warnings"][0]["warning_type"] == "input_schema_drift"
