<div align="center">

# ProxyTrace

Execution tracing, deterministic replay, and regression capture for enterprise AI agents.

**AINS Hackathon 2026 · Use Case 2 · Agent Execution Tracer and Deterministic Replay Engine**

</div>

---

## Overview

ProxyTrace is a debugging and evaluation layer for tool-using AI agents in enterprise workflows. It records an agent run as a structured trace, replays the run from stored snapshots instead of live calls, blocks side-effecting tools during replay, and lets a developer patch a step to see how the trajectory changes.

The current implementation targets a Jira triage agent with two tools: `get_project_key` (read-only lookup) and `update_ticket` (write tool that changes ticket routing state).

The backend and the Phase 2 replay/evaluation path are implemented and verified against Neon PostgreSQL. Render deployment, Forge UI integration, and real Jira workspace execution are still pending — see [Status](#status).

## Problem

Traditional debugging assumes a failure can be reproduced. AI agents break that assumption: rerunning the same task can produce different model outputs, different tool calls, or repeated side effects.

In an enterprise setting, that creates three practical problems:

- an engineer may not know which step caused a failed Jira action;
- rerunning the agent can modify live systems again;
- incidents are difficult to turn into regression tests.

ProxyTrace addresses this by preserving the execution state of a run and replaying it from recorded snapshots instead of live services.

## Status

### Acceptance Criteria Mapping

| AINS Use Case 2 Criterion | Current Prototype Support |
|---|---|
| Record functionality | Implemented. Runs store LLM snapshots and tool-call payloads in Neon. |
| Deterministic replay | Implemented. Strict replay serves recorded snapshots and reports determinism metrics. |
| State inspection | Implemented through `GET /runs/{run_id}` and persisted `snapshot` JSON fields. |
| Side-effect-safe debugging | Implemented. Write/destructive tools are blocked by the firewall during replay. |
| Divergence editing | Implemented for prompt patches and tool-result patches. |
| Human-readable verdict | Implemented at backend level through structured evaluator output. UI presentation is pending. |
| Regression capture | Implemented as frozen trace assertions. Fresh-agent regression re-execution is pending. |

### Remaining Work

1. Complete the public Render deployment and verify the health check.
2. Connect a real Atlassian/Jira developer workspace (demo tools currently use local handlers).
3. Build the Forge issue panel / React frontend (Phase 3).
4. Generate the 20-trace synthetic evaluation set against the existing label targets, then run and publish the evaluation report (Phase 4).
5. Add Alembic migrations — the schema is currently created with `create_all`.
6. Extend the regression runner to re-execute a fresh agent version against frozen assertions, rather than only checking consistency of the frozen trace itself.
7. Add fuller route-level tests for the regression endpoints.

## Architecture

```mermaid
graph LR
    Agent["Demo / Enterprise Agent"] -->|"LLM call"| LLM["Gemini Capture Adapter"]
    Agent -->|"tool call"| Proxy["Tool Proxy Gateway"]
    LLM --> Store[("Trace Store<br/>Neon PostgreSQL")]
    Proxy --> Contracts["Tool Contract Registry"]
    Contracts --> Firewall["Side-Effect Firewall"]
    Proxy --> Store
    Store --> Strict["Strict Replay"]
    Store --> Explore["Exploratory Replay"]
    Explore --> Diff["Trajectory + Outcome Diff"]
    Diff --> Scorer["Gemini Structured Scorer"]
    Scorer --> Regression["Regression Pack"]
```

ProxyTrace captures the model layer and the tool layer separately. The tool proxy can see tool calls and side-effect risk, but not prompts or model responses — so a dedicated Gemini adapter captures model traffic while the MCP-style proxy captures tool execution.

| Layer | Captures | Current Integration |
|---|---|---|
| Gemini SDK capture adapter | system prompt, messages, model name, response payload, token usage, prompt/response hashes | wraps `google.genai.Client.models.generate_content(...)` and posts snapshots to `POST /llm/capture` when a run context is active |
| Tool Proxy Gateway | tool name, input parameters, output payload, latency, status, side-effect class, contract hashes | agent calls `POST /mcp`; the gateway validates the registered contract, records the step, and executes the live handler only during recording |
| Trace Store | run metadata, ordered steps, snapshots, replay verdicts, warnings, regression packs | Neon PostgreSQL with JSONB snapshots and async SQLAlchemy access |

## Replay, Patch & Scoring

```mermaid
flowchart TD
    RUN["Recorded run in Neon"] --> STRICT["Strict Replay"]
    STRICT --> SAFETY{"Write or destructive tool?"}
    SAFETY -->|Yes| BLOCK["Firewall logs side_effect_blocked"]
    SAFETY -->|No| SNAPSHOT["Serve recorded snapshot"]
    BLOCK --> INSPECT["Inspect ordered steps and snapshots"]
    SNAPSHOT --> INSPECT
    INSPECT --> PATCH["Apply prompt or tool-result patch"]
    PATCH --> EXPLORE["Exploratory Replay"]
    EXPLORE --> DIFF["Trajectory and final-state diff"]
    DIFF --> CHECKS["Deterministic verdict"]
    CHECKS --> GEMINI["Gemini structured scorer"]
    GEMINI --> REPORT["Persist human-readable verdict"]
    REPORT --> REGRESS["Promote to Regression Pack"]
```

The Gemini scorer is the only LLM call in this path: deterministic checks decide what changed, and the scorer explains the likely cause in strict JSON. Malformed scorer output falls back to a human-review verdict.

| Field | Meaning |
|---|---|
| `root_cause_step` | step index most likely responsible for the divergence |
| `divergence_type` | one of `wrong_argument`, `wrong_tool`, `wrong_order`, `hallucinated_value`, or `schema_violation` |
| `affected_steps` | downstream steps affected by the patch or divergence |
| `risk_level` | `low`, `medium`, `high`, or `critical` |
| `recommendation` | one concrete remediation sentence |
| `judge_confidence` | confidence from `0.0` to `1.0`; values below `0.7` require human review |

## Setup

1. Create a `.env` file from the template.

```powershell
Copy-Item .env.example .env
```

2. Set required environment variables.

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST/proxytrace?sslmode=require
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite
```

3. Install dependencies and initialize the database.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m proxytrace.db.init_db
```

4. Run the backend.

```powershell
uvicorn proxytrace.proxy.main:app --reload
```

5. Record a demo trace.

```powershell
python -m proxytrace.agent_demo.run_demo --issue-key DEMO-1 --summary "API deploy pipeline fails" --description "The platform release pipeline fails after an API change."
```

6. Run strict replay.

```powershell
$runId = "<run_id>"
Invoke-RestMethod -Method Post "http://localhost:8000/runs/$runId/replay/strict"
```

Expected replay properties:

- `live_call_count` is `0`
- write tools are marked `side_effect_blocked`
- `determinism_rate` reflects recorded-vs-replayed step sequence matching
- side-effect warnings are written to `drift_warnings`

## API Surface

| Endpoint | Purpose |
|---|---|
| `GET /health` | service health check |
| `POST /runs` | start an agent run |
| `GET /runs` | list recorded runs |
| `GET /runs/{run_id}` | inspect run metadata and steps |
| `GET /runs/{run_id}/warnings` | inspect firewall and drift warnings |
| `POST /llm/capture` | record an LLM prompt/response snapshot |
| `POST /mcp` | proxy and record a tool call |
| `POST /runs/{run_id}/complete` | mark a run completed or failed |
| `POST /runs/{run_id}/replay/strict` | replay from recorded snapshots |
| `POST /runs/{run_id}/replay/exploratory` | apply a patch and compare the branched trajectory |
| `POST /replay/exploratory` | exploratory replay with `run_id` in the request body |
| `POST /regression/promote` | freeze an exploratory replay into regression assertions |
| `GET /regression` | list promoted regression tests |
| `POST /regression/run-all` | run frozen regression assertions |

## Evaluation Plan

Label targets for the evaluation set are defined in `proxytrace/data/labels.json`, covering 20 traces:

- 5 clean runs
- 4 wrong tool argument failures
- 4 wrong tool selection failures
- 3 untrusted context injection failures
- 2 wrong tool order failures
- 2 schema drift warnings

Planned metrics: replay determinism rate, side-effect blocking rate, divergence localization accuracy, judge agreement rate, end-state equivalence, and regression pass rate.

## Repository Structure

```text
proxytrace/
  agent_demo/          demo Jira triage agent and runner
  contracts/           tool contract registry and schema hashing
  data/                evaluation labels and later seed data
  db/                  SQLAlchemy models, sessions, repository helpers
  evaluator/           divergence diff, Gemini scorer, hybrid evaluator
  llm_adapter/         LLM capture helpers and Gemini SDK patch
  patch/               patch engine
  proxy/               FastAPI app, routes, MCP-style proxy
  regression_pack/     regression promotion and assertion runner
  replay/              strict and exploratory replay engines
tests/
  test_*.py            focused backend tests
render.yaml            Render web service configuration
```

---

Built for AINS Hackathon 2026, Use Case 2.