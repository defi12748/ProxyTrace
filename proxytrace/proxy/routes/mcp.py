from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.repository import get_run
from proxytrace.db.session import get_session
from proxytrace.proxy.mcp_proxy import ToolProxyGateway
from proxytrace.schemas import ToolCallRequest


router = APIRouter(tags=["mcp"])
gateway = ToolProxyGateway()


@router.post("/mcp")
async def mcp_tool_call(
    request: ToolCallRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    if await get_run(session, request.run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    result = await gateway.record_and_execute(session, request)
    await session.commit()
    return result

