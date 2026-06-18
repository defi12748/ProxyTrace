from __future__ import annotations

import time
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.atlassian.tools import JIRA_TOOL_HANDLERS
from proxytrace.contracts.registry import get_contract_or_default
from proxytrace.contracts.schema_hasher import hash_schema
from proxytrace.db.repository import contract_to_dict, record_step, step_to_dict
from proxytrace.drift.checker import DriftChecker, DriftCheckResult
from proxytrace.privacy.redaction import redact_sensitive_data, redaction_metadata
from proxytrace.proxy.demo_tools import DEMO_TOOL_HANDLERS
from proxytrace.schemas import ToolCallRequest
from proxytrace.settings import get_settings


class ToolProxyGateway:
    def __init__(self, *, drift_checker: DriftChecker | None = None) -> None:
        self.drift_checker = drift_checker or DriftChecker()

    async def record_and_execute(
        self,
        session: AsyncSession,
        request: ToolCallRequest,
    ) -> dict[str, Any]:
        contract = await get_contract_or_default(session, request.tool_name)
        started = time.perf_counter()
        status = "ok"

        try:
            response = await self._execute_tool(request.tool_name, request.params)
        except Exception as exc:  # noqa: BLE001 - proxy must log failed tool calls too.
            status = "error"
            response = {
                "error": type(exc).__name__,
                "message": str(exc),
            }

        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        settings = get_settings()
        redaction_enabled = settings.redaction_enabled
        stored_params = redact_sensitive_data(
            request.params,
            enabled=redaction_enabled,
        )
        stored_response = redact_sensitive_data(response, enabled=redaction_enabled)
        stored_snapshot = redact_sensitive_data(
            request.snapshot or {"params": request.params},
            enabled=redaction_enabled,
        )
        stored_snapshot = self._snapshot_with_contract_metadata(
            stored_snapshot,
            contract_descriptor_hash=contract.descriptor_hash,
        )
        payload = {
            "tool_name": request.tool_name,
            "params": stored_params,
            "response": stored_response,
            "latency_ms": latency_ms,
            "status": status,
            "input_schema_hash": hash_schema(stored_params),
            "output_schema_hash": hash_schema(stored_response),
            "contract": contract_to_dict(contract),
            "side_effect_class": contract.tool_type,
            "redaction": redaction_metadata(redaction_enabled),
        }
        step = await record_step(
            session,
            run_id=request.run_id,
            step_type="tool",
            payload=payload,
            snapshot=stored_snapshot,
            step_index=request.step_index,
        )
        drift = await self.drift_checker.check_step(
            session,
            step=step,
            run_id=request.run_id,
        )
        return {
            "run_id": request.run_id,
            "step": step_to_dict(step),
            "tool_name": request.tool_name,
            "status": status,
            "latency_ms": latency_ms,
            "response": response,
            "side_effect": contract.side_effect,
            "replay_policy": contract.replay_policy,
            "drift": self._drift_to_dict(drift),
        }

    async def _execute_tool(self, tool_name: str, params: dict[str, Any]) -> Any:
        settings = get_settings()
        if not settings.demo_tool_mode and settings.atlassian_configured:
            handler = JIRA_TOOL_HANDLERS.get(tool_name)
            if handler is None:
                raise ValueError(f"No Jira handler registered for tool {tool_name!r}")
            return await handler(params)

        if settings.tool_upstream_base_url:
            base_url = settings.tool_upstream_base_url.rstrip("/")
            async with httpx.AsyncClient(timeout=settings.tool_timeout_seconds) as client:
                response = await client.post(f"{base_url}/tools/{tool_name}", json=params)
                response.raise_for_status()
                return response.json()

        if not settings.demo_tool_mode:
            raise RuntimeError(
                "Real tool mode requires Atlassian credentials or TOOL_UPSTREAM_BASE_URL."
            )

        if settings.demo_tool_mode:
            handler = DEMO_TOOL_HANDLERS.get(tool_name)
            if handler is None:
                raise ValueError(f"No demo handler registered for tool {tool_name!r}")
            return await handler(params)

        raise ValueError(f"No handler registered for tool {tool_name!r}")

    def _snapshot_with_contract_metadata(
        self,
        snapshot: dict[str, Any],
        *,
        contract_descriptor_hash: str,
    ) -> dict[str, Any]:
        enriched = dict(snapshot)
        enriched["contract_descriptor_hash"] = contract_descriptor_hash
        return enriched

    def _drift_to_dict(self, drift: DriftCheckResult) -> dict[str, Any]:
        return {
            "checked": True,
            "tool_name": drift.tool_name,
            "step_id": drift.step_id,
            "drifted": drift.drifted,
            "finding_count": len(drift.findings),
            "findings": [
                {
                    "kind": finding.kind.value,
                    "old_hash": finding.old_hash,
                    "new_hash": finding.new_hash,
                    "detail": finding.detail,
                }
                for finding in drift.findings
            ],
        }
