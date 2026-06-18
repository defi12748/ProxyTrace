from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from proxytrace.db.models import ToolContract


BLOCKED_TOOL_TYPES = {"write", "destructive"}


@dataclass(frozen=True)
class FirewallDecision:
    allowed: bool
    action: str
    reason: str
    details: dict[str, Any] = field(default_factory=dict)


class SideEffectFirewall:
    """Blocks live side effects during replay while keeping recorded data inspectable."""

    def inspect_replay_call(
        self,
        *,
        tool_name: str,
        params: dict[str, Any],
        contract: ToolContract,
    ) -> FirewallDecision:
        if contract.tool_type in BLOCKED_TOOL_TYPES or contract.side_effect:
            return FirewallDecision(
                allowed=False,
                action="side_effect_blocked",
                reason=(
                    f"{tool_name} is classified as {contract.tool_type}; "
                    "strict replay cannot forward side-effecting tools."
                ),
                details={
                    "tool_name": tool_name,
                    "params": params,
                    "replay_policy": contract.replay_policy,
                    "requires_approval": contract.requires_approval,
                },
            )
        return FirewallDecision(
            allowed=True,
            action="mocked_from_recording",
            reason="Read-only tool response served from recorded snapshot.",
            details={"tool_name": tool_name, "replay_policy": contract.replay_policy},
        )
