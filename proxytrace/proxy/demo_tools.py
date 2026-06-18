from __future__ import annotations

from typing import Any


def _classify(summary: str, description: str = "") -> tuple[str, list[str], float]:
    text = f"{summary} {description}".lower()
    rules = [
        ("PLATFORM", ["api", "deploy", "platform", "release", "pipeline"]),
        ("INFRA", ["database", "latency", "network", "server", "infra"]),
        ("SECURITY", ["auth", "token", "permission", "oauth", "security"]),
        ("BILLING", ["invoice", "payment", "billing", "subscription"]),
    ]
    for board, keywords in rules:
        evidence = [keyword for keyword in keywords if keyword in text]
        if evidence:
            return board, evidence[:3], 0.91
    return "TRIAGE", [], 0.52


async def get_project_key(params: dict[str, Any]) -> dict[str, Any]:
    board, evidence, confidence = _classify(
        params.get("summary", ""),
        params.get("description", ""),
    )
    return {
        "project_key": board,
        "project_name": f"Demo {board.title()}",
        "issue_key": params.get("issue_key"),
        "issue_type": "Task",
        "status": "Recorded",
        "confidence": confidence,
        "evidence": evidence,
        "source": "demo_tool",
    }


async def update_ticket(params: dict[str, Any]) -> dict[str, Any]:
    return {
        "updated": True,
        "issue_key": params.get("issue_key"),
        "board": params.get("board"),
        "reason": params.get("reason"),
        "status": "mocked_local_demo",
        "comment_id": "",
        "source": "demo_tool",
    }


DEMO_TOOL_HANDLERS = {
    "get_project_key": get_project_key,
    "update_ticket": update_ticket,
}
