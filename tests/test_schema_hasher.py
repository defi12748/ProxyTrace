from proxytrace.contracts.schema_hasher import hash_json, hash_schema


def test_hash_json_is_order_stable() -> None:
    assert hash_json({"b": 2, "a": 1}) == hash_json({"a": 1, "b": 2})


def test_hash_schema_ignores_values_but_tracks_shape() -> None:
    assert hash_schema({"board": "PLATFORM"}) == hash_schema({"board": "INFRA"})
    assert hash_schema({"board": "PLATFORM"}) != hash_schema({"board": 123})

