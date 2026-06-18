from proxytrace.db.models import ToolContract
from proxytrace.replay.firewall import SideEffectFirewall


def test_firewall_blocks_write_tools_in_strict_replay() -> None:
    contract = ToolContract(
        tool_name="update_ticket",
        version="v1",
        tool_type="write",
        input_schema_hash="sha256:in",
        output_schema_hash="sha256:out",
        descriptor_hash="sha256:desc",
        side_effect=True,
        requires_approval=True,
        replay_policy="mock_only",
        trust_level="trusted_internal",
    )

    decision = SideEffectFirewall().inspect_replay_call(
        tool_name="update_ticket",
        params={"issue_key": "DEMO-1", "board": "INFRA"},
        contract=contract,
    )

    assert decision.allowed is False
    assert decision.action == "side_effect_blocked"
