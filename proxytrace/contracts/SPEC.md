# ProxyTrace Tool Contract Specification v1

Status: implemented reference specification.

## Purpose

A ProxyTrace tool contract freezes the safety and compatibility properties needed to record, replay, and drift-check a tool call. It is independent of any transport protocol. The current gateway is typed HTTP; this specification does not claim MCP JSON-RPC compatibility.

## Contract identity

A contract is uniquely identified by `(tool_name, version)`. Implementations must persist:

| Field | Type | Meaning |
|---|---|---|
| `tool_name` | string | Stable tool identifier used in traces. |
| `version` | string | Contract version, currently `v1`. |
| `tool_type` | `read`, `write`, or `destructive` | Safety classification. |
| `side_effect` | boolean | Whether execution can mutate an external system. |
| `requires_approval` | boolean | Whether a live call requires human/policy approval. |
| `replay_policy` | string | Replay behavior such as `mock_from_recording` or `mock_only`. |
| `trust_level` | string | Provenance classification such as `trusted_internal`. |
| `input_schema_hash` | SHA-256 identifier | Canonical inferred JSON shape of parameters. |
| `output_schema_hash` | SHA-256 identifier | Canonical inferred JSON shape of the response. |
| `descriptor_hash` | SHA-256 identifier | Hash of safety metadata plus both schema hashes. |

## Canonical schema hashing

`infer_json_shape` recursively replaces values with JSON types, sorts object keys, and infers array shape from the first element. `hash_schema` serializes that shape with sorted compact JSON and prefixes its SHA-256 digest with `sha256:`. Values may change without causing drift; field names, nesting, and JSON types may not.

An empty array has item type `unknown`. `null`, boolean, integer, number, string, object, and array are distinct shapes.

## Recording requirements

For every tool call, the gateway must store the tool name, redacted parameters and response, status, latency, input/output schema hashes, complete contract metadata, and side-effect class. The current `descriptor_hash` must also be copied into the step snapshot as `contract_descriptor_hash` so later checks can distinguish schema drift from descriptor drift.

Sensitive values must be redacted before hashing and persistence so contract evidence never becomes a secret bypass.

## Replay requirements

Strict replay must never forward a tool when `tool_type` is `write` or `destructive`, or when `side_effect` is true. It must return an intercepted/simulated response to the executing agent and persist a `side_effect_blocked` warning.

Read tools are also intercepted during strict replay; `mock_from_recording` means the recorded response is served without contacting the provider. `mock_only` forbids provider execution in all replay modes.

Exploratory replay may regenerate model decisions, but tool-provider call count must remain zero. A patched tool result changes only that boundary; downstream changes must come from agent re-execution, never contract-specific payload mutation.

## Drift findings

Implementations must report the following independently:

| Finding | Comparison |
|---|---|
| `input_schema_drift` | live recorded parameter shape vs contract `input_schema_hash` |
| `output_schema_drift` | live recorded response shape vs contract `output_schema_hash` |
| `descriptor_drift` | step snapshot `contract_descriptor_hash` vs current contract `descriptor_hash` |

Findings must include old/new hashes, tool name, step identity, and a human-readable remediation. Rechecking the same `(step_id, warning_type)` must be idempotent.

## Versioning

An intentional incompatible shape or safety-policy change requires a new contract version and new baselines. Silent replacement of a version is permitted only during local seed/bootstrap before any baseline depends on it.

## Reference implementation

- Registry: `proxytrace/contracts/registry.py`
- Canonical hashing: `proxytrace/contracts/schema_hasher.py`
- Recording gateway: `proxytrace/proxy/mcp_proxy.py`
- Drift checker: `proxytrace/drift/checker.py`
- Replay firewall: `proxytrace/replay/firewall.py`
