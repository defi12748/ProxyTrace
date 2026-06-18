from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Request

from proxytrace.agent_demo.agent import JiraTriagingAgent
from proxytrace.agent_demo.tools import ProxyTraceClient
from proxytrace.atlassian.jira_client import JiraClient, JiraConfigError
from proxytrace.schemas import JiraTraceRequest


router = APIRouter(prefix="/jira", tags=["jira"])


@router.get("/issues/{issue_key}")
async def get_jira_issue(issue_key: str) -> dict[str, object]:
    try:
        issue = await JiraClient().get_issue(issue_key.strip().upper())
    except JiraConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Jira returned {exc.response.status_code} for issue lookup.",
        ) from exc
    return {"issue": issue.__dict__}


@router.post("/trace")
async def trace_jira_issue(
    request: JiraTraceRequest,
    http_request: Request,
) -> dict[str, object]:
    issue_key = request.issue_key.strip().upper()
    if not issue_key:
        raise HTTPException(status_code=400, detail="issue_key is required")

    try:
        issue = await JiraClient().get_issue(issue_key)
        api_base_url = str(http_request.base_url).rstrip("/")
        agent = JiraTriagingAgent(client=ProxyTraceClient(base_url=api_base_url))
        result = await agent.run(
            issue_key=issue.key,
            summary=issue.summary,
            description=issue.description,
        )
    except JiraConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Jira returned {exc.response.status_code} during trace.",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    run = result["run"]
    return {
        "run_id": run["run_id"],
        "run": run,
        "issue": issue.__dict__,
        "project_lookup": result["project_lookup"],
        "update": result["update"],
    }
