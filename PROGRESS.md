# ProxyTrace Engineering Status

Last verified: 2026-06-22.

## Implemented

- Live FastAPI/Neon recording for ordered Gemini and tool boundaries.
- Real Jira Cloud issue reads and a reversible trace-comment write.
- Recursive redaction before trace persistence.
- Versioned tool contracts with input, output, and descriptor hashes.
- Automatic three-dimensional drift checks on every recorded tool call.
- Side-effect firewall for write/destructive replay calls.
- Strict replay that executes the current Jira agent workflow against recorded interceptors with zero model/tool provider calls.
- Exploratory replay that applies one boundary patch, regenerates downstream Gemini decisions, re-executes agent control flow, and keeps every tool provider intercepted.
- Gemini-driven demo decisions; no keyword fallback controls the workflow.
- Visibly degraded no-AI evaluation with no fabricated root cause, risk, recommendation, or semantic assertions.
- Blind offline evaluation: labels are unavailable to evaluators and are read only after model calls for scoring.
- Regression promotion plus fresh current-agent re-execution against saved assertions.
- Configurable fail-closed API credential auth, server-pinned authenticated workspace, workspace-scoped API queries, and explicit CORS policy.
- React/Vite `frontend-v2`, Render configuration, and Forge Custom UI integration.
- Reusable tool-contract specification in `proxytrace/contracts/SPEC.md`.
- Committed evaluation trace, JSON, and Markdown artifacts.

## Verification

- Backend: 54 tests passing.
- Python package: `python -m compileall -q proxytrace` passing.
- Standalone console: `npm --prefix frontend-v2 run build` passing.
- Forge Custom UI: production build passing.
- Forge app: `forge lint` reports no issues.

## Honest limits

- The real Jira write adds a comment; it does not move an issue between projects or boards.
- Exploratory execution currently targets the Jira triage workflow rather than arbitrary agent implementations.
- The HTTP Tool Proxy Gateway is not an MCP JSON-RPC server; `/mcp` is a hidden deprecated compatibility alias.
- Strict determinism measures current-agent behavior under frozen recorded model/tool responses. It does not claim that a fresh live model call is deterministic.
- The committed no-key evaluation report marks AI-only accuracy as N/A. Regenerate without `--no-ai` when a judging credential is available.
- API-key auth fits the current single-workspace deployment. A multi-user production service still needs short-lived identity-provider tokens, audit policy, and rate limiting.
