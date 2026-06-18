<div align="center">

# ProxyTrace

Execution tracing, deterministic replay, and regression capture for enterprise AI agents.

**AINS Hackathon 2026 · Use Case 2 · Agent Execution Tracer and Deterministic Replay Engine**

</div>

---

## Overview

ProxyTrace is a debugging and evaluation layer for tool-using AI agents in enterprise workflows. The prototype records an agent run as a structured trace, stores LLM and tool-call snapshots, replays the run without making live external calls, blocks side-effecting tools during replay, and allows a developer to patch a step to inspect how the trajectory changes.

The current implementation targets a Jira triage agent with two tools:

- `get_project_key` — read-only classification/lookup tool
- `update_ticket` — write tool that changes ticket routing state

The project is a work in progress. The backend foundation and Phase 2 replay/evaluation path are implemented and verified against Neon PostgreSQL. Render deployment, Forge UI integration, and real Jira workspace execution are still pending.

## Problem

Traditional debugging assumes that a failure can be reproduced. AI agents break that assumption: rerunning the same task can produce different model outputs, different tool calls, or repeated side effects.

In an enterprise setting, that creates three practical problems:

- an engineer may not know which step caused a failed Jira action;
- rerunning the agent can modify live systems again;
- incidents are difficult to turn into regression tests.

ProxyTrace addresses this by preserving the execution state of a run and replaying it from recorded snapshots instead of live services.

## Current Status

Implemented:

- FastAPI backend with health, run, trace, replay, and regression endpoints
- Neon PostgreSQL trace store via SQLAlchemy async and `asyncpg`
- Gemini SDK capture path for `google.genai.Client.models.generate_content(...)`
- MCP-style tool proxy endpoint at `POST /mcp`
- tool contract registry with schema hashes and side-effect classification
- strict replay with zero live tool calls
- side-effect firewall for write/destructive tools
- sequence-based determinism metrics
- exploratory replay with prompt/tool-result patching
- trajectory diff and semantic final-state diff
- Gemini structured scorer with strict JSON validation and fallback handling
- regression promotion and frozen assertion runner
- 20 human labels for the planned evaluation set

Pending:

- Render public deployment health check
- Atlassian Forge issue panel
- real Jira developer workspace tool execution
- Alembic migrations
- fuller route-level tests for regression endpoints
- Phase 3 frontend
- Phase 4 evaluation report

## Acceptance Criteria Mapping

| AINS Use Case 2 Criterion | Current Prototype Support |
|---|---|
| Record functionality | Implemented. Runs store LLM snapshots and tool-call payloads in Neon. |
| Deterministic replay | Implemented. Strict replay serves recorded snapshots and reports determinism metrics. |
| State inspection | Implemented through `GET /runs/{run_id}` and persisted `snapshot` JSON fields. |
| Side-effect-safe debugging | Implemented. Write/destructive tools are blocked by the firewall during replay. |
| Divergence editing | Implemented for prompt patches and tool-result patches. |
| Human-readable verdict | Implemented at backend level through structured evaluator output. UI presentation is pending. |
| Regression capture | Implemented as frozen trace assertions. Fresh-agent regression re-execution is pending. |

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

## Capture Model

ProxyTrace captures the model layer and the tool layer separately. The tool proxy can see tool calls and side-effect risk, but it cannot reliably see prompts and model responses. The Gemini adapter captures model traffic, while the MCP-style proxy captures tool execution.

| Layer | Captures | Current Integration |
|---|---|---|
| Gemini SDK capture adapter | system prompt, messages, model name, response payload, token usage, prompt/response hashes | wraps `google.genai.Client.models.generate_content(...)` and posts snapshots to `POST /llm/capture` when a run context is active |
| Tool Proxy Gateway | tool name, input parameters, output payload, latency, status, side-effect class, contract hashes | agent calls `POST /mcp`; the gateway validates the registered contract, records the step, and executes the live handler only during recording |
| Trace Store | run metadata, ordered steps, snapshots, replay verdicts, warnings, regression packs | Neon PostgreSQL with JSONB snapshots and async SQLAlchemy access |

## Core Workflows

### Live Recording

```mermaid
sequenceDiagram
    autonumber
    participant Agent
    participant Gemini as Gemini SDK Adapter
    participant API as ProxyTrace API
    participant Registry as Tool Contract Registry
    participant Store as Trace Store
    participant Tool as Demo/Upstream Tool

    Agent->>API: POST /runs
    API->>Store: create run
    Agent->>Gemini: generate_content(...) with trace context
    Gemini->>API: POST /llm/capture
    API->>Store: store prompt, messages, model response, prompt hash
    Gemini-->>Agent: model response
    Agent->>API: POST /mcp get_project_key
    API->>Registry: validate contract and side-effect class
    Registry-->>API: schema hash, descriptor hash, replay policy
    API->>Store: store tool params and contract metadata
    API->>Tool: execute read tool
    Tool-->>API: project key response
    API->>Store: store response, status, latency
    Agent->>API: POST /mcp update_ticket
    API->>Registry: classify write contract
    API->>Tool: execute write tool during live recording
    API->>Store: store response and side-effect classification
    API-->>Agent: tool response
```

### Strict Replay

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Replay as Strict Replay
    participant Store as Trace Store
    participant Firewall as Side-Effect Firewall

    User->>Replay: replay run_id
    Replay->>Store: load recorded steps
    Replay->>Replay: serve LLM output from snapshot
    Replay->>Firewall: inspect update_ticket contract
    Firewall-->>Replay: blocked: side_effect_blocked
    Replay->>Store: log side_effect_blocked warning
    Replay-->>User: determinism_rate, live_call_count, replayed_steps
```

### Exploratory Replay

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Replay as Exploratory Replay
    participant Patch as Patch Engine
    participant Diff as Divergence Diff
    participant Scorer as Gemini Scorer
    participant Store as Trace Store

    User->>Replay: patch step and run exploratory replay
    Replay->>Patch: apply prompt or tool-result patch
    Patch-->>Replay: patched trajectory
    Replay->>Diff: compare original vs patched trajectory
    Diff-->>Replay: trajectory and final-state diff
    Replay->>Scorer: request structured explanation
    Scorer-->>Replay: root cause, affected steps, confidence
    Replay->>Store: persist exploratory replay verdict
```

### Replay, Patch, And Scoring

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

### Structured Scorer Contract

The Gemini scorer is the only LLM call in the replay/evaluation path. Deterministic checks decide what changed; the scorer explains the likely cause in strict JSON. Malformed scorer output falls back to a human-review verdict.

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

## Known Limitations

- The current regression runner validates frozen trace consistency and final-state assertions. It does not yet re-execute a fresh agent version against the frozen assertions.
- The database schema is created with `create_all` for the prototype. Alembic migrations are planned.
- The demo tools currently use local handlers. Real Atlassian/Jira tool execution is pending.
- The Forge issue panel and React frontend are not implemented yet.
- Render deployment configuration exists, but the public deployment still needs to be performed and verified.

## Evaluation Plan

The planned evaluation set is stored in `proxytrace/data/labels.json` and contains 20 labeled traces:

- 5 clean runs
- 4 wrong tool argument failures
- 4 wrong tool selection failures
- 3 untrusted context injection failures
- 2 wrong tool order failures
- 2 schema drift warnings

Planned metrics:

- replay determinism rate
- side-effect blocking rate
- divergence localization accuracy
- judge agreement rate
- end-state equivalence
- regression pass rate

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

## Roadmap

1. Complete public Render deployment and health check.
2. Connect a real Atlassian developer workspace.
3. Build the React/Forge issue-panel interface.
4. Generate the 20-trace synthetic evaluation set.
5. Run and publish the evaluation report.
6. Add Alembic migrations and production deployment hardening.

---

Built for AINS Hackathon 2026, Use Case 2.
