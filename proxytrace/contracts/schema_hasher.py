from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def hash_json(value: Any) -> str:
    digest = hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def infer_json_shape(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: infer_json_shape(value[key])
            for key in sorted(value.keys())
        }
    if isinstance(value, list):
        if not value:
            return {"type": "array", "items": "unknown"}
        return {"type": "array", "items": infer_json_shape(value[0])}
    if value is None:
        return {"type": "null"}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, int) and not isinstance(value, bool):
        return {"type": "integer"}
    if isinstance(value, float):
        return {"type": "number"}
    return {"type": "string"}


def hash_schema(value: Any) -> str:
    return hash_json(infer_json_shape(value))

