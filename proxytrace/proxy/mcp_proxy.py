from __future__ import annotations

import time
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.contracts.registry import get_contract_or_default
from proxytrace.contracts.schema_hasher import hash_schema
from proxytrace.db.repository import contract_to_dict, record_step, step_to_dict
from proxytrace.proxy.demo_tools import DEMO_TOOL_HANDLERS
from proxytrace.schemas import ToolCallRequest
from proxytrace.settings import get_settings


class ToolProxyGateway:
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
        payload = {
            "tool_name": request.tool_name,
            "params": request.params,
            "response": response,
            "latency_ms": latency_ms,
            "status": status,
            "input_schema_hash": hash_schema(request.params),
            "output_schema_hash": hash_schema(response),
            "contract": contract_to_dict(contract),
            "side_effect_class": contract.tool_type,
        }
        step = await record_step(
            session,
            run_id=request.run_id,
            step_type="tool",
            payload=payload,
            snapshot=request.snapshot or {"params": request.params},
            step_index=request.step_index,
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
        }

    async def _execute_tool(self, tool_name: str, params: dict[str, Any]) -> Any:
        settings = get_settings()
        if settings.demo_tool_mode or not settings.tool_upstream_base_url:
            handler = DEMO_TOOL_HANDLERS.get(tool_name)
            if handler is None:
                raise ValueError(f"No demo handler registered for tool {tool_name!r}")
            return await handler(params)

        base_url = settings.tool_upstream_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=settings.tool_timeout_seconds) as client:
            response = await client.post(f"{base_url}/tools/{tool_name}", json=params)
            response.raise_for_status()
            return response.json()

