# ProxyTrace Progress

Last verified: 2026-06-18, Africa/Lagos.

Source of truth: `ProxyTrace_WinningPlan (3).docx`.

Important override: the docx names a different scorer provider in examples, but the project instruction is to use Gemini. The repo now uses `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.1-flash-lite`.

## Alignment Verdict

We are aligned with the docx direction and Phase 1 architecture, but we are not 100% complete against the full docx gate yet.

## Completion Estimate

Overall docx plan: about 22% complete.

Phase 1 foundation code: about 78% complete.

Phase 1 gate proof: about 68% complete, because the code path has now been proven with Neon, 5 demo traces, and one live Gemini-patched LLM capture run, but not yet with Render, Forge Remote, or real Jira tools.

Breakdown:

- Day 0 infrastructure: about 45%; Neon schema init is verified, Render config exists, but Render deploy and Forge spike are not connected yet.
- Phase 1 recording/proxy/replay/firewall: about 78%; core backend modules exist, 5 Neon-backed demo traces replayed, and Gemini SDK capture was verified, but real Atlassian verification is still missing.
- Phase 2 patch/diff/evaluator/regression: about 5%; DB tables exist, but implementation has not started.
- Phase 3 frontend/Forge UI: 0%; not started.
- Phase 4 evaluation/polish: about 10%; labels exist, but trace generation and metrics are not implemented.

What is aligned:

- Stack direction: Python, FastAPI, React later, Neon PostgreSQL, Render, Forge.
- Core product loop: record -> replay -> patch -> diff -> explain -> regress.
- Phase 1 priority: record, strict replay, side-effect firewall before frontend.
- Demo-agent order: agent first, proxy second.
- Tool model: `get_project_key` is read-only, `update_ticket` is side-effecting write.
- Data model direction: runs, steps, tool contracts, replays, regression pack, drift warnings.
- Evaluation labels exist before scorer work.

What is not fully proven yet:

- Neon schema initialization has been verified with the supplied `DATABASE_URL`.
- Render deployment has not been performed or health-checked from a public URL.
- Forge Day 0 spike has not been scaffolded/deployed.
- The demo agent has not been run against a real Atlassian developer workspace.
- The docx asks for 5 complete Neon traces; 5 demo-mode traces have now been recorded and replayed against Neon.
- The Gemini SDK monkey-patch exists, is tested, and the demo agent now uses it for normal LLM turns when `GEMINI_API_KEY` is present.
- Alembic migrations are not added yet; `proxytrace.db.init_db` creates tables directly for the foundation.

## Done

### 2026-06-17

- Created the Python project foundation with `pyproject.toml`, `requirements.txt`, and Render deployment config.
- Added FastAPI backend entrypoint at `proxytrace/proxy/main.py`.
- Added health, run, LLM capture, MCP proxy, and strict replay routes.
- Added async SQLAlchemy models for:
  - `runs`
  - `steps`
  - `tool_contracts`
  - `replays`
  - `regression_pack`
  - `drift_warnings`
- Added repository helpers for run creation, step recording, warning logging, and trace inspection.
- Added default tool contracts for:
  - `get_project_key`
  - `update_ticket`
- Added schema hashing utilities for payload and contract integrity checks.
- Added demo Jira triaging agent with the docx Phase 1 tools.
- Added local demo tool handlers so the proxy path can be tested before Atlassian credentials exist.
- Added strict replay engine.
- Added side-effect firewall that blocks write/destructive calls during strict replay.
- Added tests for schema hashing and firewall behavior.

### 2026-06-18

- Re-read `ProxyTrace_WinningPlan (3).docx` and corrected repo assumptions against it.
- Removed the old local file-database fallback from env, dependencies, settings, docs, and local artifacts.
- Replaced the old scorer env config with Gemini config.
- Set default Gemini model to `gemini-3.1-flash-lite`.
- Updated deployment target to Render per project decision.
- Moved labels to the docx-aligned path: `proxytrace/data/labels.json`.
- Updated README to treat the docx plan as source of truth.
- Added Neon `sslmode=require` normalization for SQLAlchemy asyncpg URLs.
- Verified no active old database/scorer config remains in the project files touched.
- Ran `pytest`; all current tests passed.
- Ran `python -m compileall proxytrace tests`; compile check passed.

### 2026-06-18 Follow-up Fixes

- Replaced hardcoded strict replay determinism with sequence-based comparison:
  - compares recorded `(step_type, tool_name)` signatures
  - compares replayed `(step_type, tool_name)` signatures
  - stores matching step count, total step count, mismatches, and real rate
- Added `proxytrace/llm_adapter/gemini_patch.py`.
- Gemini patch wraps `google.genai.Client` and captures `models.generate_content(...)` automatically when a run context is set.
- Added tests for Gemini monkey-patch capture.
- Refactored the demo agent's normal LLM path to call Gemini through the monkey-patched SDK instead of explicitly calling `capture_llm()`.
- Replaced deprecated FastAPI `on_event("startup")` with lifespan startup.
- Added `google-genai` to Python dependencies.
- Fixed Neon URL normalization for `channel_binding=require`, which asyncpg does not accept as a connection keyword.
- Ran `python -m proxytrace.db.init_db` successfully against Neon.
- Recorded and strict-replayed 5 Neon-backed demo traces:
  - each trace had 4 steps
  - each replay returned `determinism_rate=1.0`
  - each replay had `matching_steps=4`
  - each replay had `live_call_count=0`
  - each replay blocked `update_ticket`
  - each replay logged one `side_effect_blocked` warning
- Ran one Neon-backed demo trace through live Gemini-patched LLM capture:
  - run ID: `e162e15f-54c3-4ade-a762-694d37da1cd4`
  - 2 LLM steps captured via Gemini SDK patch
  - 2 tool steps captured via `/mcp`
  - strict replay returned `determinism_rate=1.0`
  - strict replay returned `matching_steps=4`
  - strict replay returned `live_call_count=0`
  - strict replay blocked one `update_ticket`

## Current Files That Matter

- `README.md` - judge-facing project explanation and setup path.
- `.env.example` - Neon, Render/FastAPI, Gemini, and Atlassian env placeholders.
- `render.yaml` - Render web service deploy config.
- `proxytrace/proxy/main.py` - FastAPI app.
- `proxytrace/proxy/mcp_proxy.py` - tool proxy gateway.
- `proxytrace/agent_demo/agent.py` - demo Jira triaging agent.
- `proxytrace/llm_adapter/adapter.py` - LLM snapshot capture helper.
- `proxytrace/llm_adapter/gemini_patch.py` - Gemini SDK monkey-patch capture path.
- `proxytrace/replay/strict_replay.py` - strict replay engine.
- `proxytrace/replay/firewall.py` - side-effect firewall.
- `proxytrace/contracts/registry.py` - default tool contracts.
- `proxytrace/db/models.py` - Neon/PostgreSQL table models.
- `proxytrace/data/labels.json` - 20 human labels for evaluation.

## Next Work

### Immediate Day 0 / Day 1 Gate Work

1. Deploy FastAPI backend to Render.
2. Add Render env vars:
   - `DATABASE_URL`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL=gemini-3.1-flash-lite`
3. Verify Render `GET /health` returns 200.
4. Run the demo agent through the Render `/mcp` URL.
5. Run strict replay on Render-recorded traces and confirm:
   - determinism rate is `1.0`
   - live call count is `0`
   - `update_ticket` is blocked by the firewall
   - warnings are logged in `drift_warnings`

### Phase 1 Hardening

1. Add Alembic migrations to replace direct `create_all` for production readiness.
2. Wire the demo tools to a real Atlassian developer workspace.
3. Add drift checker module for descriptor/schema mismatch warnings.
4. Add deeper tests for proxy recording and strict replay.

### Phase 2

1. Add `proxytrace/patch/patch_engine.py`.
2. Implement prompt patch and tool-result patch first.
3. Add exploratory replay from a patch point.
4. Add trajectory diff and semantic outcome diff.
5. Add Gemini structured scorer with strict JSON validation.
6. Add hybrid evaluator: deterministic checks first, Gemini explanation second.
7. Add regression promotion endpoint.

### Phase 3

1. Scaffold React + Vite frontend.
2. Build trace timeline.
3. Build step inspector.
4. Build patch modal.
5. Build diff view with ReactFlow.
6. Build regression test view.
7. Connect Forge issue panel to the Render backend.

### Phase 4

1. Add trace generator and seed script.
2. Generate 20 synthetic traces from `proxytrace/data/labels.json`.
3. Run evaluation metrics:
   - replay determinism rate
   - side-effect blocking rate
   - divergence localisation accuracy
   - judge agreement rate
   - end-state equivalence
   - regression pass rate
4. Write `evaluation_report.md`.
5. Publish `contracts/SPEC.md` as the open contribution artifact.
6. Record the final 5-minute demo video.

## Current Risk Register

- No Render deployment yet means Forge Remote cannot call the backend yet.
- No Forge spike yet means commercial integration is not proven.
- No real Jira workspace run yet means the current demo agent is still a local proxy proof.
- Gemini model name is set to `gemini-3.1-flash-lite`; if the provider exposes a different canonical ID, update env only.
