from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.repository import get_run_for_workspace
from proxytrace.db.session import get_session
from proxytrace.llm_adapter.adapter import record_llm_snapshot
from proxytrace.schemas import LLMCaptureRequest
from proxytrace.proxy.auth import APIContext, require_api_context


router = APIRouter(tags=["llm"])


@router.post("/llm/capture")
async def capture_llm_step(
    request: LLMCaptureRequest,
    session: AsyncSession = Depends(get_session),
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    if await get_run_for_workspace(
        session, request.run_id, context.workspace_id
    ) is None:
        raise HTTPException(status_code=404, detail="run not found")
    step = await record_llm_snapshot(
        session,
        run_id=request.run_id,
        model=request.model,
        system_prompt=request.system_prompt,
        messages=request.messages,
        response=request.response,
        token_usage=request.token_usage,
        step_index=request.step_index,
        snapshot=request.snapshot,
    )
    await session.commit()
    return {"step": step}
