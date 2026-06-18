from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.contracts.schema_hasher import hash_json, hash_schema
from proxytrace.db.models import ToolContract
from proxytrace.db.repository import get_contract


DEFAULT_TOOL_DESCRIPTORS: dict[str, dict[str, Any]] = {
    "get_project_key": {
        "version": "v1",
        "tool_type": "read",
        "side_effect": False,
        "requires_approval": False,
        "replay_policy": "mock_from_recording",
        "trust_level": "trusted_internal",
        "input_example": {
            "issue_key": "SCRUM-1",
            "summary": "Task 1",
            "description": "Trace the Jira issue through ProxyTrace.",
        },
        "output_example": {
            "project_key": "SCRUM",
            "project_name": "VECTORS",
            "issue_key": "SCRUM-1",
            "issue_type": "Task",
            "status": "To Do",
            "confidence": 0.92,
            "evidence": ["https://proxytrace.atlassian.net/browse/SCRUM-1"],
            "source": "jira_cloud",
        },
    },
    "update_ticket": {
        "version": "v1",
        "tool_type": "write",
        "side_effect": True,
        "requires_approval": True,
        "replay_policy": "mock_only",
        "trust_level": "trusted_internal",
        "input_example": {
            "issue_key": "SCRUM-1",
            "board": "SCRUM",
            "reason": "The issue project was validated through Jira Cloud.",
        },
        "output_example": {
            "updated": True,
            "issue_key": "SCRUM-1",
            "board": "SCRUM",
            "reason": "The issue project was validated through Jira Cloud.",
            "status": "jira_comment_added",
            "comment_id": "10000",
            "source": "jira_cloud",
        },
    },
}


def build_contract(tool_name: str, descriptor: dict[str, Any]) -> ToolContract:
    input_example = descriptor["input_example"]
    output_example = descriptor["output_example"]
    descriptor_material = {
        key: value
        for key, value in descriptor.items()
        if key not in {"input_example", "output_example"}
    }
    descriptor_material["input_schema"] = hash_schema(input_example)
    descriptor_material["output_schema"] = hash_schema(output_example)
    return ToolContract(
        tool_name=tool_name,
        version=descriptor.get("version", "v1"),
        tool_type=descriptor["tool_type"],
        input_schema_hash=hash_schema(input_example),
        output_schema_hash=hash_schema(output_example),
        descriptor_hash=hash_json(descriptor_material),
        side_effect=bool(descriptor.get("side_effect", False)),
        requires_approval=bool(descriptor.get("requires_approval", False)),
        replay_policy=descriptor.get("replay_policy", "mock_from_recording"),
        trust_level=descriptor.get("trust_level", "trusted_internal"),
    )


async def ensure_default_contracts(session: AsyncSession) -> None:
    for tool_name, descriptor in DEFAULT_TOOL_DESCRIPTORS.items():
        contract = build_contract(tool_name, descriptor)
        await session.merge(contract)
    await session.flush()


async def get_contract_or_default(
    session: AsyncSession, tool_name: str, version: str = "v1"
) -> ToolContract:
    contract = await get_contract(session, tool_name, version)
    if contract is not None:
        return contract
    descriptor = DEFAULT_TOOL_DESCRIPTORS.get(tool_name)
    if descriptor is None:
        descriptor = {
            "version": version,
            "tool_type": "read",
            "side_effect": False,
            "requires_approval": False,
            "replay_policy": "mock_from_recording",
            "trust_level": "unregistered",
            "input_example": {},
            "output_example": {},
        }
    contract = build_contract(tool_name, descriptor)
    session.add(contract)
    await session.flush()
    return contract
