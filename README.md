<div align="center">

# ProxyTrace

Execution tracing, deterministic replay, and regression capture for enterprise AI agents.

**AINS Hackathon 2026 · Use Case 2 · Agent Execution Tracer and Deterministic Replay Engine**

</div>

---

## Overview

ProxyTrace is a debugging and evaluation layer for tool-using AI agents in enterprise workflows. It records an agent run as a structured trace, replays the run from stored snapshots instead of live calls, blocks side-effecting tools during replay, and lets a developer patch a step to see how the trajectory changes.

The current implementation targets a Jira triage agent with two tools: `get_project_key` (read-only Jira project lookup) and `update_ticket` (controlled Jira write, currently implemented as a trace comment).

The backend and the Phase 2 replay/evaluation path are implemented and verified against Neon PostgreSQL. The full-stack Render deployment is live at `https://proxytrace.onrender.com`: Render builds the React console, runs Alembic migrations, starts the FastAPI API, and serves the frontend from the same service. The Forge Custom UI issue context panel is deployed in the development environment and installed on `proxytrace.atlassian.net`, where it embeds the ProxyTrace console directly inside Jira issues.

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
| Human-readable verdict | Implemented through structured evaluator output and surfaced in the console report panels. |
| Regression capture | Implemented as frozen trace assertions and AI-derived semantic assertions. Fresh-agent regression re-execution is pending. |
| Data sensitivity | Implemented for capture paths with recursive redaction before prompt/tool payloads are stored. |
| Contract drift detection | Implemented. `/mcp` records descriptor hashes, checks drift automatically, and drift endpoints support on-demand re-checks. |
| Frontend console | Implemented as a React/Vite operator console for Jira issue trigger, trace list, timeline, inspector, replay, patch, diff, drift, and regression flows. It is hosted on Render and embedded in Jira through Forge Custom UI. |

### Remaining Work

1. Add Jira workflow transition support after reading the project transition IDs.
2. Publish the final evaluation/SPEC artifacts and demo video.
3. Extend the regression runner to re-execute a fresh agent version against frozen assertions, rather than only checking consistency of the frozen trace itself.
4. Harden production operations around auth, rate limits, logs, and Render cold-start behavior.

## Architecture

```mermaid
graph LR
    Agent["Demo / Enterprise Agent"] -->|"LLM call"| LLM["Gemini Capture Adapter"]
    Agent -->|"tool call"| Proxy["Tool Proxy Gateway"]
    LLM --> Store[("Trace Store<br/>Neon PostgreSQL")]
    Proxy --> Contracts["Tool Contract Registry"]
    Contracts --> Firewall["Side-Effect Firewall"]
    Contracts --> Drift["Contract Drift Checker"]
    Proxy --> Drift
    Proxy --> Store
    Drift --> Store
    Store --> Strict["Strict Replay"]
    Store --> Explore["Exploratory Replay"]
    Explore --> Diff["Trajectory + Outcome Diff"]
    Diff --> Scorer["Gemini Structured Scorer<br/>+ Semantic Outcome Judge"]
    Scorer --> Regression["Regression Pack"]
```

ProxyTrace captures the model layer and the tool layer separately. The tool proxy can see tool calls and side-effect risk, but not prompts or model responses — so a dedicated Gemini adapter captures model traffic while the MCP-style proxy captures tool execution.

| Layer | Captures | Current Integration |
|---|---|---|
| Gemini SDK capture adapter | system prompt, messages, model name, response payload, token usage, prompt/response hashes | wraps `google.genai.Client.models.generate_content(...)` and posts snapshots to `POST /llm/capture` when a run context is active |
| Tool Proxy Gateway | tool name, input parameters, output payload, latency, status, side-effect class, contract hashes, drift result | agent calls `POST /mcp`; the gateway validates the registered contract, records the step, executes the live handler during recording, and checks drift immediately |
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
    CHECKS --> GEMINI["Gemini structured scorer<br/>+ semantic judge"]
    GEMINI --> REPORT["Persist human-readable verdict"]
    REPORT --> REGRESS["Promote to Regression Pack"]
```

The Gemini evaluator returns strict JSON for root cause, affected steps, risk, confidence, recommendation, expected business outcome, and semantic regression assertions. Malformed scorer output falls back to a human-review verdict.

| Field | Meaning |
|---|---|
| `root_cause_step` | step index most likely responsible for the divergence |
| `divergence_type` | one of `wrong_argument`, `wrong_tool`, `wrong_order`, `hallucinated_value`, or `schema_violation` |
| `affected_steps` | downstream steps affected by the patch or divergence |
| `risk_level` | `low`, `medium`, `high`, or `critical` |
| `recommendation` | one concrete remediation sentence |
| `judge_confidence` | confidence from `0.0` to `1.0`; values below `0.7` require human review |
| `expected_final_state` | AI-derived semantic assertion for the intended Jira outcome |
| `satisfies_expected_outcome` | whether the replayed final state satisfies that intended outcome |

## AI Mechanism

ProxyTrace is built for AI-agent failures, so its AI role is not a generic chat layer. The Gemini path captures model decisions, produces structured divergence verdicts, extracts the intended Jira routing outcome from trace context, decides whether a replay satisfies that outcome, and freezes semantic assertions into the regression pack. Removing Gemini would leave raw replay infrastructure, but not the semantic failure attribution and regression judgment layer.

## Data Sensitivity

Prompt and tool payloads are redacted before persistence. The current policy masks emails, bearer/API-token-like values, and fields whose names look secret-bearing, such as `token`, `api_key`, `authorization`, `password`, or `client_secret`. Redaction is enabled by default with `REDACTION_ENABLED=true`.

## Differentiation

ProxyTrace is not just an observability trace viewer. Its core difference is side-effect-safe debugging: replay serves recorded snapshots, write/destructive tools are blocked by the firewall, developers can patch a failing step, and successful patched trajectories can be promoted into regression assertions.

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

3. Install dependencies and apply the database schema.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"

# Apply the Alembic migration (creates all tables)
alembic upgrade head

# Seed default tool contracts (get_project_key, update_ticket)
python -m proxytrace.db.init_db
```

`alembic upgrade head` is the authoritative schema bootstrap for both local and deployed environments.
`python -m proxytrace.db.init_db` seeds the default tool contracts the proxy needs on first run.
It does **not** create or alter tables — that is Alembic's job exclusively.

4. Run the backend.

```powershell
uvicorn proxytrace.proxy.main:app --reload
```

5. Run the frontend console.

```powershell
cd frontend
npm install
npm run dev
```

6. Trace a real Jira issue from the UI, or use the API.

```powershell
Invoke-RestMethod -Method Post "http://127.0.0.1:8000/jira/trace" -ContentType "application/json" -Body '{"issue_key":"SCRUM-1"}'
```

7. Run strict replay from the UI, or use the API.

```powershell
$runId = "<run_id>"
Invoke-RestMethod -Method Post "http://127.0.0.1:8000/runs/$runId/replay/strict"
```

Expected replay properties:

- `live_call_count` is `0`
- write tools are marked `side_effect_blocked`
- `determinism_rate` reflects recorded-vs-replayed step sequence matching
- side-effect warnings are written to `drift_warnings`

## Database Migrations

ProxyTrace uses [Alembic](https://alembic.sqlalchemy.org/) for schema management.
All table creation and alteration is owned by migrations — `proxytrace.db.init_db` only seeds seed data.

### Files

| File | Purpose |
|---|---|
| `alembic.ini` | Alembic configuration; `script_location = migrations` |
| `migrations/env.py` | Loads `DATABASE_URL` from env via `proxytrace.settings`; runs async migrations |
| `migrations/script.py.mako` | Template for new migration scripts |
| `migrations/versions/20260618_0001_initial_schema.py` | Initial migration — creates all six tables |

### Common Commands

```powershell
# Apply all pending migrations (deploy and local bootstrap)
alembic upgrade head

# Show current applied revision
alembic current

# Show full migration history
alembic history --verbose

# Roll back the most recent migration (development only)
alembic downgrade -1

# Auto-generate a new migration after editing models.py
# (always review the generated file before committing)
alembic revision --autogenerate -m "describe your change"
```

### Creating a New Migration

1. Edit `proxytrace/db/models.py` with the schema change.
2. Run `alembic revision --autogenerate -m "short description"`.
3. Review the generated file in `migrations/versions/`.
4. Apply it locally with `alembic upgrade head`.
5. Commit both the model change and the migration file together.

### Deployment

`render.yaml` installs the Python package, builds the React frontend, and runs `alembic upgrade head` as part of the build command before the service starts.
No manual schema management is needed on Render — migrations run automatically on every deploy.

```yaml
buildCommand: pip install -e . && npm --prefix frontend ci && npm --prefix frontend run build && alembic upgrade head
```

## Render Deployment Check

Render uses `render.yaml` to install dependencies, build the standalone frontend, run `alembic upgrade head`, and start the FastAPI service. The current public service is:

```text
https://proxytrace.onrender.com
```

Configure these environment variables in Render:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST/proxytrace?sslmode=require
PROXYTRACE_API_URL=https://proxytrace.onrender.com
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite
REDACTION_ENABLED=true
DEMO_TOOL_MODE=false
ATLASSIAN_SITE_URL=https://proxytrace.atlassian.net
ATLASSIAN_EMAIL=...
ATLASSIAN_API_TOKEN=...
ATLASSIAN_PROJECT_KEY=SCRUM
```

Verify the deployed API:

```powershell
$baseUrl = "https://proxytrace.onrender.com"
Invoke-RestMethod "$baseUrl/health"
Invoke-RestMethod "$baseUrl/runs?limit=1"
Invoke-RestMethod "$baseUrl/regression?limit=1"
```

Record and replay a deployed trace:

```powershell
$env:PROXYTRACE_API_URL = $baseUrl
$trace = Invoke-RestMethod -Method Post "$baseUrl/jira/trace" -ContentType "application/json" -Body '{"issue_key":"SCRUM-1"}'
$runId = $trace.run_id
Invoke-RestMethod -Method Post "$baseUrl/runs/$runId/replay/strict"
Invoke-RestMethod "$baseUrl/runs/$runId/warnings"
```

The strict replay should report `live_call_count=0`, `determinism_rate=1.0`, and a blocked `update_ticket` side effect warning for runs that include the write step.

## Forge Jira Issue Panel

The Forge app lives in `forge-app` and embeds the custom React console from `forge-app/static/hello-world` as a `jira:issueContext` module. It is deployed to the Forge development environment and installed on:

```text
proxytrace.atlassian.net
```

The issue panel:

- reads the current Jira issue key from `@forge/bridge` context
- pre-fills the trace input and trace-list filter
- calls the Render API at `https://proxytrace.onrender.com`
- renders the trace list, timeline, inspector, ReactFlow replay graph, replay controls, drift metrics, and regression controls inside the Jira issue view

Important Forge details:

| File | Purpose |
|---|---|
| `forge-app/manifest.yml` | declares the `jira:issueContext` module, custom UI resource, resolver, Jira scope, and client/backend egress to Render |
| `forge-app/src/index.js` | resolver used by the Forge app |
| `forge-app/static/hello-world/src/App.tsx` | Forge-mounted React console |
| `forge-app/static/hello-world/vite.config.ts` | Vite config with relative asset base for Forge static hosting |

Deploy the Forge UI after changing the custom UI or manifest:

```powershell
cd forge-app\static\hello-world
npm install
npm run build

cd ..\..
forge lint
forge deploy --non-interactive -e development
```

If `manifest.yml` changes scopes, egress, modules, or permissions, upgrade the installed development app after deploy:

```powershell
forge install --non-interactive --upgrade --site proxytrace.atlassian.net --product jira --environment development
```

The latest verified Forge deployment fixed two integration issues:

- invalid React hook usage before render, which caused a blank Jira panel
- missing production API base/client egress, which caused the panel to call Atlassian's CDN instead of the Render backend

## API Surface

| Endpoint | Purpose |
|---|---|
| `GET /health` | service health check |
| `POST /runs` | start an agent run |
| `GET /runs` | list recorded runs |
| `GET /runs/{run_id}` | inspect run metadata and steps |
| `GET /runs/{run_id}/warnings` | inspect firewall and drift warnings |
| `GET /jira/issues/{issue_key}` | fetch a real Jira issue from Atlassian Cloud |
| `POST /jira/trace` | trigger a traced agent run from a real Jira issue key |
| `POST /llm/capture` | record an LLM prompt/response snapshot |
| `POST /mcp` | proxy and record a tool call |
| `POST /drift/check` | check one recorded tool step for contract drift |
| `POST /runs/{run_id}/drift/check-all` | re-check every tool step in a run |
| `GET /runs/{run_id}/drift` | list persisted drift warnings for a run |
| `POST /runs/{run_id}/complete` | mark a run completed or failed |
| `POST /runs/{run_id}/replay/strict` | replay from recorded snapshots |
| `POST /runs/{run_id}/replay/exploratory` | apply a patch and compare the branched trajectory |
| `POST /replay/exploratory` | exploratory replay with `run_id` in the request body |
| `POST /regression/promote` | freeze an exploratory replay into regression assertions |
| `GET /regression` | list promoted regression tests |
| `POST /regression/run-all` | run frozen regression assertions |

## Frontend Console

The standalone React console lives in `frontend`. It uses `VITE_PROXYTRACE_API_URL` to call the FastAPI backend and defaults to `http://127.0.0.1:8000` in local development. On Render, `render.yaml` builds `frontend/dist` and `proxytrace.proxy.frontend.mount_frontend()` serves it from the FastAPI app.

The Forge issue-panel console lives in `forge-app/static/hello-world`. It shares the same core interaction model but reads Jira issue context from `@forge/bridge` and defaults production API calls to `https://proxytrace.onrender.com`.

On Windows, `start.ps1` stops existing listeners on ports `8000` and `5173`, starts the backend and frontend in separate terminal tabs or windows, and opens the console.

Current views:

- real Jira issue trigger by issue key
- trace list filtered by Jira issue key
- ordered LLM/tool timeline
- step inspector for payload and snapshot JSON
- strict replay controls and safety metrics
- exploratory patch replay with board override
- ReactFlow trajectory graph
- Gemini divergence / semantic judgment panel
- drift warnings and regression-pack controls

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
  drift/               contract drift checker
  evaluator/           divergence diff, Gemini scorer, hybrid evaluator
  llm_adapter/         LLM capture helpers and Gemini SDK patch
  patch/               patch engine
  privacy/             trace redaction helpers
  proxy/               FastAPI app, routes, MCP-style proxy
  regression_pack/     regression promotion and assertion runner
  replay/              strict and exploratory replay engines
migrations/
  env.py               Alembic async migration runner
  versions/            versioned migration scripts
tests/
  test_*.py            focused backend tests
frontend/              React/Vite ProxyTrace console
forge-app/             Forge Custom UI issue-context app for Jira
  manifest.yml         Forge modules, resource, resolver, scopes, and egress
  src/                 Forge resolver function
  static/hello-world/  Forge-mounted React/Vite console bundle
alembic.ini            Alembic configuration
render.yaml            Render web service configuration
Makefile               local dev convenience targets
start.ps1              local launcher for backend and frontend
```

---

Built for AINS Hackathon 2026, Use Case 2.
