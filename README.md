<div align="center">

# ProxyTrace

A side-effect-safe deterministic replay engine for tool-using enterprise AI agents, featuring MCP-compatible proxy interception, LLM prompt capture, patch-and-replay debugging, structured divergence analysis, and automatic regression-test generation.

> AINS Hackathon 2026 

</div>

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [System Architecture](#system-architecture)
- [Current Scope](#current-scope)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)

---

## Problem Statement

When a traditional software system fails, an engineer opens the stack trace, reproduces the bug locally, and fixes it. The loop is tight and predictable.

When an AI agent fails in production, the loop collapses:

- It routed 12 Jira tickets to the wrong board.
- It hallucinated a SQL parameter and queried the wrong database.
- It drafted an aggressive email and sent it.

You cannot reproduce the failure by simply running the agent again, because the underlying LLM will make different decisions on the next run. And if you try anyway, the agent may trigger the **same live side effect a second time**: another ticket gets modified, another email goes out.

There is currently no safe "replay" button for agentic systems the way there is for a stack trace or `git bisect` in traditional software. Existing observability tools (LangSmith, LangFuse, W&B Weave) give you logs, they tell you **what happened**. None of them tell you **what would have happened if you'd done something differently**, and none of them guarantee that finding out won't touch a live system.

---

## Solution

**ProxyTrace fixes this gap.**

It is an AgentOps infrastructure layer that:

- records the agent's full execution trace: every LLM prompt, every tool call, every response, every context snapshot;
- replays incidents deterministically without touching live systems;
- lets developers patch a prompt or tool result at the exact failing step;
- compares the original and fixed trajectories;
- explains the divergence in a structured, human-readable report;
- promotes failed runs into reusable regression tests.

The core loop:

```
record → replay → patch → diff → explain → regress
```

ProxyTrace is not another enterprise agent, it is the infrastructure layer that makes *any* MCP-compatible agent inspectable, replayable, and regression-testable.


---

## System Architecture

### High-level overview

```mermaid
graph LR
    A["Enterprise Agent<br/>MCP client"] -->|"LLM calls + tool calls"| B["ProxyTrace Proxy<br/>FastAPI"]
    B -->|"Validates contract,<br/>blocks live writes on replay"| C["Side-Effect Firewall"]
    B -->|"Persists traces,<br/>snapshots, contracts"| D[("Postgres<br/>Trace Store")]
    D -->|"Loads recorded steps"| E{"Replay Engine<br/>Strict / Exploratory"}
    E -->|"Compares trajectories,<br/>scores divergence"| F["AI Divergence Scorer"]
    F -->|"Promotes verdict"| G["Regression Pack"]

    style B fill:#16a34a,stroke:#0f172a,color:#fff
    style E fill:#ea580c,stroke:#0f172a,color:#fff
    style D fill:#2563eb,stroke:#0f172a,color:#fff
    style A fill:#1e293b,stroke:#475569,color:#fff
    style C fill:#1e293b,stroke:#475569,color:#fff
    style F fill:#1e293b,stroke:#475569,color:#fff
    style G fill:#1e293b,stroke:#475569,color:#fff
```

### Live recording sequence

How a single agent run is captured without interfering with execution:

```mermaid
sequenceDiagram
    autonumber
    participant Agent
    participant LLM as LLM Adapter
    participant Proxy as Tool Proxy
    participant Registry as Tool Contract Registry
    participant Store as Trace Store
    participant Tool as Real Tool

    Agent->>LLM: LLM request(messages, system_prompt)
    LLM->>Store: store LLM snapshot(prompt, messages, model, response hash)
    LLM-->>Agent: LLM response(tool intent / decision)

    Agent->>Proxy: tool_call(name, params)
    Proxy->>Registry: validate tool contract and side-effect class
    Registry-->>Proxy: contract metadata
    Proxy->>Store: store tool call params + contract hashes

    Proxy->>Tool: forward live call
    Tool-->>Proxy: response(payload, latency, status)

    Proxy->>Store: store tool response + latency + status
    Proxy-->>Agent: return response
```

### Replay and patch flow

How a recorded incident is safely replayed, patched, and turned into a verdict:

```mermaid
flowchart TD
    START["Load recorded incident trace"] --> STRICT["Run Strict Replay"]
    STRICT --> CHECK1{"Live side effect attempted?"}
    CHECK1 -->|Yes| BLOCK["Side-Effect Firewall blocks live action<br/>UI: LIVE SIDE EFFECT BLOCKED"]
    CHECK1 -->|No| INSPECT["Inspect original steps in Step Inspector"]

    BLOCK --> INSPECT
    INSPECT --> PATCH["Patch prompt, variable, or tool result at failing step"]
    PATCH --> EXPLORE["Run Exploratory Replay from patch point"]
    EXPLORE --> DIFF["Compare trajectory: original vs replayed"]
    DIFF --> OUTCOME["Compare semantic outcome: final state correct?"]
    OUTCOME --> REPORT["Generate structured Divergence Report"]
    REPORT --> REGRESS["Promote incident to Regression Pack"]
```

### Divergence scorer: the only LLM call in the replay pipeline

```mermaid
flowchart LR
    subgraph IN["Input"]
        I1[Original trajectory JSON]
        I2[Replayed trajectory JSON]
        I3[Patch step ID]
    end

    subgraph SCORER["AI API call — structured output enforced"]
        SC["Prompt: compare trajectories step by step"]
    end

    subgraph OUT["Output"]
        O1["root_cause_step: step ID"]
        O2["divergence_type: string"]
        O3["affected_steps: list"]
        O4["risk_level: high / medium / low"]
        O5["recommendation: string"]
        O6["judge_confidence: 0.0–1.0"]
    end

    IN --> SC --> OUT
```

The scorer receives two trajectory JSONs and a patch point, and returns a structured object, never an open-ended chat response. The deterministic checks (tool match, schema validity, side-effect blocking, final-state equivalence) decide what happened; the LLM judge only explains why.

### Two complementary capture mechanisms

A tool proxy alone cannot reliably see LLM prompts. This is why capture is intentionally split in two:

| Mechanism | Captures |
|---|---|
| **LLM Instrumentation Adapter** | system prompt, messages array, model name/version, LLM request and response, token usage, prompt/response hashes |
| **Tool Proxy Gateway** | tool name, input parameters, output payload, latency and status, side-effect classification, tool contract version, schema/descriptor hashes |

The agent points to `localhost:8000/mcp` instead of the real tool URL — **one environment variable change, zero agent code modified.**

---

## Current Scope

ProxyTrace's MVP scope is intentionally bounded so that every **Must** acceptance criterion is solid before anything else is attempted.

**In scope:**

- MCP-compatible tools used by a single demo agent (Jira triaging agent: `get_project_key` + `update_ticket`)
- Two-layer capture: LLM Instrumentation Adapter + Tool Proxy Gateway
- **Strict Replay**: fully deterministic, zero live calls, write/destructive actions blocked by the Side-Effect Firewall
- **Exploratory Replay**: controlled divergence after a developer patches a step
- **Patch Engine**: prompt patch, variable patch, tool-result patch, validation patch
- **Tool Contract Registry** with schema/descriptor hashes and drift warnings (MVP-level: hashes + warnings, not full enforcement)
- **Divergence Diff** at two levels: trajectory diff and semantic outcome diff
- **Hybrid Evaluator**: deterministic checks as the primary source of truth, LLM judge for explanation only
- **Regression Pack**: one-click promotion of a failed run into a replayable regression test with assertions
- Evaluation on a 20-trace synthetic test set with documented metrics
---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| API / runtime | FastAPI (async) | low-latency interception, MCP-compatible routing |
| ORM / driver | SQLAlchemy (async) + asyncpg | typed Postgres access, Alembic migrations |
| LLM capture | lightweight LLM adapter | captures prompts the tool proxy cannot see |
| Tool proxy | MCP-compatible proxy | intercepts tool calls, supports mock injection |
| Trace DB | PostgreSQL | relational integrity for runs/steps, JSONB for snapshots, scales past hackathon demo size |
| Snapshot storage | Postgres JSONB | queryable context snapshots, no separate blob store needed |
| Replay engine | Python orchestration | deterministic control over recorded traces |
| Divergence scorer | AI API (structured output) | one call per replay, no open-ended generation |
| UI | React + Vite | fast frontend |
| Graph view | ReactFlow | purpose-built for side-by-side trajectory DAGs |
| Containerization | Docker + Docker Compose | one-command spin-up of Postgres + API + UI |

No exotic infrastructure; every dependency is a single `pip install` or `npm install` away.

---

## Quick Start

```bash
# clone and set up
git clone <repo-url>
cd proxytrace

# database
docker run -d --name proxytrace-db -e POSTGRES_PASSWORD=proxytrace -p 5432:5432 postgres:16
export DATABASE_URL=postgresql://postgres:proxytrace@localhost:5432/proxytrace

# backend
pip install -r requirements.txt
alembic upgrade head
uvicorn proxy.main:app --reload

# frontend
cd ui
npm install
npm run dev
```

Point your MCP-compatible agent at the ProxyTrace proxy with a single environment variable change:

```bash
export MCP_SERVER_URL=http://localhost:8000/mcp
```

No agent code modification required.

---

## Repository Structure

```
proxytrace/
├── agent_demo/        # Jira triaging demo agent
├── llm_adapter/       # LLM prompt/message capture
├── proxy/             # MCP tool proxy gateway
├── replay/            # Strict + Exploratory replay engines
├── patch/              # Patch Engine
├── contracts/          # Tool Contract Registry
├── integrity/          # Schema hash + drift warnings
├── evaluator/          # Hybrid evaluator + divergence scorer
├── regression_pack/    # Regression test store
├── frontend/            # React + Vite frontend
├── tests/               # Pytest suite
├── data/                 # 20 synthetic traces
└── README.md
```

---

*Built for AINS Hackathon 2026 — Use Case 2: Agent Execution Tracer and Deterministic Replay Engine, in partnership with Vectors.*

**This is an active build, not a finished product. The next phase is already underway.**
