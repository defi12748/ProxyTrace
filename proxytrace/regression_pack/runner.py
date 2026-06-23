from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.models import RegressionPackItem
from proxytrace.db.repository import fetch_steps, get_run
from proxytrace.replay.agent_harness import (
    DecisionGenerator,
    GeminiDecisionGenerator,
    execute_recorded_agent,
)
from proxytrace.replay.firewall import SideEffectFirewall


class RegressionRunner:
    def __init__(
        self,
        *,
        decision_generator: DecisionGenerator | None = None,
        firewall: SideEffectFirewall | None = None,
    ) -> None:
        self.decision_generator = decision_generator or GeminiDecisionGenerator()
        self.firewall = firewall or SideEffectFirewall()

    async def run_item(
        self,
        session: AsyncSession,
        item: RegressionPackItem,
        *,
        candidate_trace: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        execution_error: dict[str, str] | None = None
        if candidate_trace is None:
            candidate_trace, execution_error = await self._rerun_agent(session, item)
        result = self._evaluate_assertions(
            item.assertions or {},
            candidate_trace=candidate_trace,
        )
        result["trace_source"] = "fresh_agent_reexecution"
        result["execution_error"] = execution_error
        if execution_error is not None:
            result["failures"].append("fresh agent re-execution did not complete")
            result["passed"] = False
        item.last_run_at = datetime.now(timezone.utc).replace(tzinfo=None)
        if result["passed"]:
            item.pass_count += 1
        else:
            item.fail_count += 1
        await session.flush()
        return {
            "test_id": item.test_id,
            "run_id": item.run_id,
            "replay_id": item.replay_id,
            **result,
        }

    async def _rerun_agent(
        self,
        session: AsyncSession,
        item: RegressionPackItem,
    ) -> tuple[list[dict[str, Any]], dict[str, str] | None]:
        run = await get_run(session, item.run_id)
        if run is None:
            return [], {"type": "RunNotFound", "message": item.run_id}
        steps = await fetch_steps(session, item.run_id)
        assertions = item.assertions or {}
        try:
            _, runtime = await execute_recorded_agent(
                run=run,
                steps=steps,
                session=session,
                firewall=self.firewall,
                mode="exploratory",
                patch_step=assertions.get("patch_step"),
                patch_payload=assertions.get("patch_payload") or {},
                decision_generator=self.decision_generator,
            )
            return runtime.events, None
        except Exception as exc:
            runtime = getattr(exc, "replay_runtime", None)
            return (
                runtime.events if runtime is not None else [],
                {"type": type(exc).__name__, "message": str(exc)},
            )

    async def run_all(
        self,
        session: AsyncSession,
        items: list[RegressionPackItem],
        *,
        candidate_traces: dict[str, list[dict[str, Any]]] | None = None,
    ) -> dict[str, Any]:
        candidate_traces = candidate_traces or {}
        results = [
            await self.run_item(
                session,
                item,
                candidate_trace=candidate_traces.get(item.test_id),
            )
            for item in items
        ]
        return {
            "total": len(results),
            "passed": sum(1 for result in results if result["passed"]),
            "failed": sum(1 for result in results if not result["passed"]),
            "results": results,
        }

    def _evaluate_assertions(
        self,
        assertions: dict[str, Any],
        *,
        candidate_trace: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        failures: list[str] = []
        frozen_trace = assertions.get("frozen_trace") or []
        trace = candidate_trace if candidate_trace is not None else frozen_trace
        trace_source = "candidate_trace" if candidate_trace is not None else "frozen_trace"
        expected_tool_sequence = assertions.get("expected_tool_sequence") or []
        actual_tool_sequence = [
            {
                "step_index": step.get("step_index"),
                "tool_name": step.get("tool_name"),
            }
            for step in trace
            if step.get("step_type") == "tool"
        ]
        if actual_tool_sequence != expected_tool_sequence:
            failures.append("tool sequence did not match regression assertion")

        expected_board = assertions.get("expected_final_board")
        actual_final_state = self._final_ticket_state(trace)
        if expected_board and actual_final_state.get("board") != expected_board:
            failures.append("final board did not match regression assertion")

        return {
            "passed": not failures,
            "failures": failures,
            "trace_source": trace_source,
            "expected_tool_sequence": expected_tool_sequence,
            "actual_tool_sequence": actual_tool_sequence,
            "expected_final_board": expected_board,
            "actual_final_state": actual_final_state,
        }

    def _final_ticket_state(self, frozen_trace: list[dict[str, Any]]) -> dict[str, Any]:
        updates = [
            step for step in frozen_trace
            if step.get("step_type") == "tool"
            and step.get("tool_name") in {"update_ticket", "escalate_ticket", "jira_set_priority"}
        ]
        if not updates:
            return {}
        payload = updates[-1].get("payload", {})
        response = payload.get("response", {}) if isinstance(payload.get("response"), dict) else {}
        params = payload.get("params", {}) if isinstance(payload.get("params"), dict) else {}
        return {
            "issue_key": response.get("issue_key") or params.get("issue_key"),
            "board": response.get("board") or params.get("board"),
            "priority": response.get("priority") or params.get("priority"),
            "updated": response.get("updated"),
            "status": response.get("status"),
        }
