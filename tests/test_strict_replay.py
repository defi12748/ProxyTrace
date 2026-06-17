from proxytrace.replay.strict_replay import calculate_determinism_rate


def test_calculate_determinism_rate_compares_recorded_and_replayed_signatures() -> None:
    recorded = [("llm", None), ("tool", "get_project_key"), ("tool", "update_ticket")]
    replayed = [("llm", None), ("tool", "get_project_key"), ("tool", "wrong_tool")]

    result = calculate_determinism_rate(recorded, replayed)

    assert result["rate"] == 2 / 3
    assert result["matching_steps"] == 2
    assert result["total_steps"] == 3
    assert result["mismatches"] == [
        {
            "position": 3,
            "recorded": ("tool", "update_ticket"),
            "replayed": ("tool", "wrong_tool"),
        }
    ]

