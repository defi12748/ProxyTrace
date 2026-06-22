from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.repository import get_run_for_workspace
from proxytrace.db.session import get_session
from proxytrace.proxy.mcp_proxy import ToolProxyGateway
from proxytrace.schemas import ToolCallRequest
from proxytrace.proxy.auth import APIContext, require_api_context


router = APIRouter(tags=["tool-proxy"])
gateway = ToolProxyGateway()


@router.post("/tool-proxy/call")
@router.post("/mcp", deprecated=True, include_in_schema=False)
async def mcp_tool_call(
    request: ToolCallRequest,
    session: AsyncSession = Depends(get_session),
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    if await get_run_for_workspace(
        session, request.run_id, context.workspace_id
    ) is None:
        raise HTTPException(status_code=404, detail="run not found")
    result = await gateway.record_and_execute(session, request)
    await session.commit()
    return result
