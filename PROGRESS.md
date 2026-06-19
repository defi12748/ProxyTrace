# ProxyTrace Progress

Last verified: 2026-06-19, Africa/Lagos.

Source of truth: `ProxyTrace_WinningPlan (3).docx`.

Important override: the docx names a different scorer provider in examples, but the project instruction is to use Gemini. The repo now uses `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.1-flash-lite`.

## Alignment Verdict

We are aligned with the docx direction and Use Case 2 architecture, and the core integration gate is now complete: backend, Render deployment, standalone frontend, Forge issue panel, real Jira issue context, replay, patch, drift, and regression controls all run through the live demo path.

The current highest-scoring remaining work is packaging and polish, not core mechanism or integration proof. ProxyTrace captures and replays AI-agent behavior, uses Gemini for structured divergence verdicts, adds a Gemini semantic outcome judge that produces assertion candidates for regression promotion, includes the synthetic evaluation pipeline, serves the full-stack app from Render, and embeds the console inside Jira through Forge Custom UI.

## Completion Estimate

Overall docx plan: about 82% complete.

Phase 1 foundation code: about 96% complete.

Phase 1 gate proof: about 92% complete, because the code path has now been proven with Neon, Render, real Jira issue reads, the Forge Jira panel, 5 demo traces, and live Gemini-patched LLM capture. Remaining Phase 1 proof is mostly deeper workflow-transition coverage and production hardening.

Breakdown:

- Day 0 infrastructure: about 100%; Neon schema init, Render deploy, Render health checks, and Forge development install are verified.
- Phase 1 recording/proxy/replay/firewall: about 96%; core backend modules exist, 5 Neon-backed demo traces replayed, Gemini SDK capture was verified, drift checker is automatically wired into `/mcp`, drift endpoints are route-tested, and real Atlassian issue reads are wired.
- Phase 2 patch/diff/evaluator/regression: 100%; patch engine, exploratory replay, divergence diff, Gemini structured scorer, hybrid evaluator, regression promotion, and run-all exist.
- Phase 3 frontend/Forge UI: about 90%; standalone React/Vite console builds and is deployed on Render, Forge Custom UI issue panel is deployed and installed, and the Jira issue context demo path works. Remaining work is polish and responsive tuning.
- Phase 4 evaluation/polish: about 65%; labels exist, synthetic traces generated, and the 20-trace evaluation report is complete. Remaining is the SPEC.md, demo video, and final narrative pass.

Judging-risk adjustment: the engineering foundation is strong, but first-place positioning depends on proving that AI is load-bearing in the replay/evaluation mechanism. Semantic outcome judging is now implemented; evaluation proof should happen before major frontend polish.

What is aligned:

- Stack direction: Python, FastAPI, React later, Neon PostgreSQL, Render, Forge.
- Core product loop: record -> replay -> patch -> diff -> explain -> regress.
- Phase 1 priority: record, strict replay, side-effect firewall, drift detection before frontend.
- Demo-agent order: agent first, proxy second.
- Tool model: `get_project_key` is read-only, `update_ticket` is side-effecting write.
- Data model direction: runs, steps, tool contracts, replays, regression pack, drift warnings.
- Evaluation labels exist before scorer work.
- Data sensitivity is now handled in capture paths with default redaction before persistence.
- Contract drift detection is now implemented, wired into the FastAPI app, and run automatically after `/mcp` records a tool step.
- Standalone React/Vite console is implemented for the core demo loop.
- Render builds and serves the full-stack app at `https://proxytrace.onrender.com`.
- Forge Custom UI is deployed to the development environment and installed on `proxytrace.atlassian.net`.
- The Jira issue panel reads `@forge/bridge` issue context, pre-fills `SCRUM-1`, calls the Render backend, and renders real trace/timeline data.

What is not fully proven yet:

- Jira workflow transition support is not implemented yet; the current write-side Jira action is a controlled comment/mock-safe trace update.
- The regression runner validates frozen trace consistency and semantic assertions, but does not yet re-execute a fresh agent version.
- The 20-trace synthetic evaluation pipeline exists; the final public evaluation artifact still needs to be published with the demo materials.
- Production-grade auth/rate-limit/logging hardening remains future work beyond the hackathon demo path.

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

### 2026-06-18 Phase 2 Start

- Fixed progress wording so Neon verification is no longer listed as unproven.
- Added `proxytrace/patch/patch_engine.py`.
- Implemented `tool_result_patch` and `prompt_patch` support.
- Implemented deterministic propagation from patched `get_project_key` responses into downstream `update_ticket` calls.
- Added `proxytrace/replay/exploratory_replay.py`.
- Added exploratory replay API endpoints:
  - `POST /replay/exploratory`
  - `POST /runs/{run_id}/replay/exploratory`
- Added `proxytrace/evaluator/divergence_diff.py`.
- Added trajectory diff with changed step count and tool sequence comparison.
- Added semantic final-state diff for `update_ticket` outcomes.
- Added `proxytrace/evaluator/hybrid_evaluator.py`.
- Added deterministic evaluator output with:
  - `root_cause_step`
  - `divergence_type`
  - `affected_steps`
  - `risk_level`
  - `recommendation`
  - `judge_confidence`
- Verified exploratory replay against Neon:
  - original run ID: `e162e15f-54c3-4ade-a762-694d37da1cd4`
  - exploratory replay ID: `ca39b769-f0c1-44fd-b468-282033079134`
  - patched step: 2
  - patched board: `SECURITY`
  - affected downstream step: 4
  - semantic final state changed to `board=SECURITY`
- Verified exploratory replay through the FastAPI endpoint:
  - endpoint: `POST /runs/{run_id}/replay/exploratory`
  - exploratory replay ID: `4fbf37fd-00d9-4f96-ab03-50dff0a6d88f`
  - patched board: `BILLING`
  - semantic final state changed
  - risk level returned as `high`
- Added tests for patch propagation, divergence diff, and deterministic evaluator.

### 2026-06-18 Judging Alignment & AI Evaluation Completion

- Generated 20 synthetic traces from `proxytrace/data/labels.json`.
- Removed `--no-ai` fallback option and fully wired Gemini into the evaluation pipeline.
- Added low-confidence semantic judge fixtures for incomplete evidence.
- Fixed `_cffi_backend` / `cryptography` installation that was breaking the `google-genai` import.
- Ran the Gemini scorer and semantic outcome judge against all 20 traces using the live API.
- Output metrics to `evaluation_report.md` proving 100% judge agreement and 70% human-review rate on the synthetic evaluation set.

### 2026-06-18 Phase 2 Completion Pass

- Added `proxytrace/evaluator/ai_scorer.py`.
- Implemented Gemini structured scorer:
  - one Gemini call per exploratory replay
  - `response_mime_type=application/json`
  - strict Pydantic validation
  - fallback verdict with `judge_confidence=0.0` and `human_review_required=true` on malformed output or scorer failure
- Wired Gemini scorer into `HybridEvaluator` after deterministic checks.
- Removed the hardcoded confidence behavior from the evaluator path.
- Added regression pack modules:
  - `proxytrace/regression_pack/pack_store.py`
  - `proxytrace/regression_pack/runner.py`
- Added regression API endpoints:
  - `POST /regression/promote`
  - `GET /regression`
  - `POST /regression/run-all`
- Regression promotion freezes:
  - patched trace
  - expected tool sequence
  - expected final state
  - expected final board
  - evaluation verdict
- Regression run-all checks frozen assertions without touching live tools.
- Verified full Phase 2 path through FastAPI against Neon:
  - exploratory replay ID: `36121572-11b5-4614-b1c5-8b4cb35bfc27`
  - scorer source: `gemini_structured_scorer`
  - judge confidence: `0.95`
  - human review required: `false`
  - promoted regression test ID: `9da664cd-c8de-460d-9687-92e81669e312`
  - expected final board: `PLATFORM`
  - regression run total: `1`
  - regression passed: `1`
  - regression failed: `0`
- Added tests for Gemini scorer valid JSON, Gemini scorer fallback, regression promotion assertions, and regression assertion runner.

### 2026-06-18 Judging Alignment Pass

- Added `proxytrace/evaluator/semantic_judge.py`.
- Implemented Gemini semantic outcome judgment:
  - reads trace context and diff
  - infers expected final Jira outcome
  - decides whether the replay satisfies that intended outcome
  - returns AI-derived assertion candidates with confidence
- Wired semantic judgment into `HybridEvaluator`.
- Wired exploratory replay to pass run metadata, original steps, and patched steps into the evaluator.
- Updated regression promotion to prefer AI-derived semantic assertions when present.
- Added `proxytrace/privacy/redaction.py`.
- Added default-on recursive capture redaction before persistence:
  - emails
  - bearer/API-token-like values
  - secret-looking keys such as `token`, `api_key`, `authorization`, `password`, and `client_secret`
- Wired redaction into:
  - LLM prompt/message/response snapshots
  - tool params/responses/snapshots stored by the proxy
- Added `REDACTION_ENABLED=true` to `.env.example`.
- Added redaction tests.
- Updated README to document:
  - AI mechanism and semantic outcome judgment
  - data sensitivity handling
  - differentiation from generic observability tooling

### 2026-06-18 Drift Detection

- Added `proxytrace/drift/checker.py` — `DriftChecker` class detecting three drift dimensions per tool step:
  - `input_schema_drift` — live call params hash differs from the recorded contract's `input_schema_hash`
  - `output_schema_drift` — tool response shape differs from the contract's `output_schema_hash`
  - `descriptor_drift` — the contract's own descriptor hash changed since the step was recorded; backwards-compatible (skips steps that predate the feature via absent `contract_descriptor_hash` in snapshot)
- All findings are persisted as `DriftWarning` rows before `check_step` returns; callers do not handle persistence.
- Added `proxytrace/proxy/routes/drift.py` with three API endpoints:
  - `POST /drift/check` — on-demand single-step check by `step_id`
  - `POST /runs/{run_id}/drift/check-all` — bulk re-check of every tool step in a run; useful after a contract update
  - `GET /runs/{run_id}/drift` — lists persisted drift warnings for a run, filtered to drift-kind types only
- Wired `drift.router` into `proxytrace/proxy/main.py`.
- Added `tests/test_drift_checker.py` — unit test suite covering:
  - all three drift kinds in isolation
  - clean (no-drift) path
  - `step_type != "tool"` early exit
  - missing `tool_name` in payload
  - `step.payload is None` guard (defensive fix)
- Fixed `log_drift_warning` in `proxytrace/db/repository.py` to deduplicate on `(step_id, warning_type)` — prevents duplicate warning rows if `check_step` is called more than once for the same step.
- Fixed `GET /runs/{run_id}/drift` to filter warnings using `DriftKind` enum values rather than a fragile string-suffix match.

### 2026-06-18 Auto Drift Recording

- Wired `DriftChecker.check_step` into the MCP proxy recording path.
- `/mcp` now embeds `contract_descriptor_hash` into each tool-step snapshot so descriptor drift is checkable for newly recorded traces.
- `/mcp` now returns a compact `drift` summary with:
  - `checked`
  - `drifted`
  - `finding_count`
  - `findings`
- Updated default tool contract output examples to match the current demo handlers and avoid false-positive drift on clean demo runs.
- Added `tests/test_mcp_proxy.py` covering:
  - descriptor hash snapshot enrichment
  - automatic drift checker invocation
  - drift summary in the proxy response
  - demo tool response shapes matching default contract hashes
- Added `tests/test_drift_routes.py` covering:
  - `POST /drift/check`
  - `POST /runs/{run_id}/drift/check-all`
  - `GET /runs/{run_id}/drift`

### 2026-06-18 Frontend Console Start

- Added root-level `frontend` React + Vite app.
- Built Vectors-styled ProxyTrace console with:
  - run list
  - trace timeline
  - step inspector
  - strict replay action
  - exploratory patch replay action
  - ReactFlow trajectory graph
  - divergence / semantic judgment report
  - drift warning panel
  - regression promote and run-all controls
- Added frontend demo recording flow that calls FastAPI directly:
  - `POST /runs`
  - `POST /llm/capture`
  - `POST /mcp`
  - `POST /runs/{run_id}/complete`
- Added `frontend/.env.example` with `VITE_PROXYTRACE_API_URL`.
- Added `start.ps1` to stop existing local listeners, start backend/frontend in separate Windows Terminal tabs or PowerShell windows, and open the console.
- Verified `npm run build` passes.

### 2026-06-18 Real Jira Trigger Start

- Added Atlassian Cloud client using `ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_TOKEN`.
- Added real Jira tool handlers:
  - `get_project_key` fetches the live Jira issue project/status/type.
  - `update_ticket` writes a controlled Jira comment as the first real side effect.
- Added `POST /jira/trace` to trigger a traced agent run from a real Jira issue key.
- Added `GET /jira/issues/{issue_key}` for read-only Jira issue validation.
- Replaced the frontend mock trace button with a Jira issue-key trigger.
- Verified read-only Jira fetch for `SCRUM-1` returns project `SCRUM`, project name `VECTORS`, status `To Do`, summary `Task 1`.

### 2026-06-18 Alembic Migration Foundation (Step 4)

- `alembic.ini` configured with `script_location = migrations`; placeholder URL in ini file replaced with a comment clarifying that the real URL is always loaded from `DATABASE_URL` via `proxytrace.settings`.
- `migrations/env.py` loads the async database URL from `get_settings()` and runs async migrations with `NullPool`.
- `migrations/versions/20260618_0001_initial_schema.py` — initial migration creates all six tables (`runs`, `steps`, `tool_contracts`, `replays`, `regression_pack`, `drift_warnings`) with all indexes and foreign keys.
- `proxytrace/db/init_db.py` refactored: removed `init_models()` / `create_all` call. The module now only seeds default tool contracts and documents that Alembic owns schema management.
- `render.yaml` build command updated from `pip install -r requirements.txt` to `pip install -e . && alembic upgrade head` so the package installs correctly and migrations run automatically on every Render deploy.
- `Makefile` added with `install`, `migrate`, `seed`, `bootstrap`, `dev`, `test`, `migrate-check`, and `downgrade` targets for local dev convenience.
- README `## Database Migrations` section added covering: migration files table, all common `alembic` commands, step-by-step instructions for creating new migrations, and deployment notes.
- README `## Setup` step 3 updated to clearly separate `alembic upgrade head` (schema) from `python -m proxytrace.db.init_db` (seed data only).

### 2026-06-19 Render + Forge Integration Completion

- Deployed the FastAPI backend and standalone frontend to Render at `https://proxytrace.onrender.com`.
- Updated `render.yaml` so Render now:
  - installs the Python package with `pip install -e .`
  - installs frontend dependencies with `npm --prefix frontend ci`
  - builds the standalone React console with `npm --prefix frontend run build`
  - runs `alembic upgrade head`
  - starts `uvicorn proxytrace.proxy.main:app --host 0.0.0.0 --port $PORT`
- Verified the public Render service:
  - `GET /health` returns `{"status":"ok","service":"proxytrace"}`
  - `GET /runs?jira_issue_key=SCRUM-1&limit=2` returns live `SCRUM-1` traces
  - `GET /regression?limit=1` returns a valid regression response
- Deployed the Forge app in `forge-app` as a `jira:issueContext` Custom UI panel.
- Installed/upgraded the Forge development app on `proxytrace.atlassian.net`.
- Verified the Jira issue panel renders inside the `SCRUM-1` issue under `proxytrace-forge DEV`.
- Fixed the blank Forge panel by moving `@forge/bridge` context lookup and React hooks inside the `App` component render lifecycle.
- Fixed Forge static asset loading by using the Vite base URL for `vectors-logo.jfif`.
- Fixed Forge production API calls by defaulting the Custom UI build to `https://proxytrace.onrender.com` instead of an empty base path.
- Added Forge Custom UI client egress to `manifest.yml`:
  - `permissions.external.fetch.client` includes `https://proxytrace.onrender.com`
  - backend egress remains allowed for the same Render host
- Rebuilt, linted, deployed, and upgraded Forge after the manifest change:
  - `npm run build`
  - `forge lint`
  - `forge deploy --non-interactive -e development`
  - `forge install --non-interactive --upgrade --site proxytrace.atlassian.net --product jira --environment development`
- Latest verified Forge development deployment: `4.0.0`.
- Verified the Forge issue panel now shows:
  - current issue key prefilled from Jira context
  - trace list filtered to `SCRUM-1`
  - ordered LLM/tool timeline
  - ReactFlow trajectory graph
  - replay controls for strict and what-if paths
  - metrics for steps, live calls, determinism, drift, and regressions

## Current Files That Matter

- `README.md` - judge-facing project explanation and setup path.
- `.env.example` - Neon, Render/FastAPI, Gemini, and Atlassian env placeholders.
- `render.yaml` - Render web service deploy config.
- `proxytrace/proxy/main.py` - FastAPI app.
- `proxytrace/proxy/mcp_proxy.py` - tool proxy gateway.
- `proxytrace/atlassian/jira_client.py` - real Jira Cloud REST client.
- `proxytrace/atlassian/tools.py` - real Jira tool handlers for recording mode.
- `proxytrace/agent_demo/agent.py` - demo Jira triaging agent.
- `proxytrace/llm_adapter/adapter.py` - LLM snapshot capture helper.
- `proxytrace/llm_adapter/gemini_patch.py` - Gemini SDK monkey-patch capture path.
- `proxytrace/replay/strict_replay.py` - strict replay engine.
- `proxytrace/replay/exploratory_replay.py` - exploratory replay engine.
- `proxytrace/patch/patch_engine.py` - prompt and tool-result patch application.
- `proxytrace/evaluator/divergence_diff.py` - trajectory and semantic final-state diff.
- `proxytrace/evaluator/hybrid_evaluator.py` - deterministic evaluator verdicts.
- `proxytrace/evaluator/ai_scorer.py` - Gemini structured scorer with strict validation and fallback.
- `proxytrace/evaluator/semantic_judge.py` - Gemini semantic outcome assertions for replay/regression judgment.
- `proxytrace/privacy/redaction.py` - default-on capture redaction for sensitive text and secret-like fields.
- `proxytrace/regression_pack/pack_store.py` - regression promotion assertion builder.
- `proxytrace/regression_pack/runner.py` - regression assertion runner.
- `proxytrace/replay/firewall.py` - side-effect firewall.
- `proxytrace/drift/checker.py` - contract drift detection across input schema, output schema, and descriptor.
- `proxytrace/proxy/routes/drift.py` - drift check API endpoints.
- `frontend` - React/Vite standalone console for Jira-triggered trace/replay loop.
- `forge-app/manifest.yml` - Forge Jira issue-context module, resource path, scopes, and Render egress.
- `forge-app/src/index.js` - Forge resolver function.
- `forge-app/static/hello-world/src/App.tsx` - Forge-mounted React/Vite console with Jira context.
- `forge-app/static/hello-world/vite.config.ts` - Vite config for Forge static Custom UI hosting.
- `start.ps1` - local launcher for backend + frontend.
- `proxytrace/contracts/registry.py` - default tool contracts.
- `proxytrace/db/models.py` - Neon/PostgreSQL table models.
- `proxytrace/data/labels.json` - 20 human labels for evaluation.

## Next Work

### Immediate Demo Packaging

1. Record the final Jira issue-panel demo path:
   - open `SCRUM-1` in Jira
   - trigger or select a traced run
   - show timeline and inspector
   - run strict replay
   - run a what-if replay
   - show semantic verdict and regression controls
2. Publish `contracts/SPEC.md` as the open contribution artifact.
3. Produce the final judge-facing README pass after the demo script is locked.
4. Capture screenshots or short clips of the Render standalone console and Forge issue panel.

### Phase 1 Hardening

1. Add Jira workflow transition support after reading available transition IDs.
2. Add deeper tests for proxy recording and strict replay.
3. Add explicit smoke-test notes for Render cold starts and public health checks.

### Phase 2

1. Add route-level tests for regression endpoints.
2. Add replay lookup endpoints if the frontend needs direct replay history.
3. Add deeper malformed-scorer fixtures and low-confidence demo trace.
4. Harden regression run-all to support future live patched-agent reruns, not only frozen assertion checks.

### Phase 3: Frontend & Jira Integration

1. Polish compact issue-panel layout after repeated Jira use.
2. Improve overflow behavior for long hashes and dense trace timelines.
3. Consider extracting shared frontend code between `frontend` and `forge-app/static/hello-world` after the hackathon deadline.
4. Add a small visible backend-status indicator for Render cold-start or API failure states.

### Phase 4: Final Polish

1. Record the final 5-minute demo video.
2. Add final evaluation artifact links.
3. Tighten language around Gemini being load-bearing in divergence attribution and semantic regression assertions.

## Current Risk Register

- Jira workflow transition support is not implemented yet; current write-side behavior is a controlled comment/mock-safe update path.
- Regression runner currently validates frozen trace consistency and final-state assertions. It does not yet re-execute a fresh agent version against the frozen assertions.
- Redaction covers common PII/secret patterns but still needs an evaluation note describing scope and limitations.
- Gemini model name is set to `gemini-3.1-flash-lite`; if the provider exposes a different canonical ID, update env only.
- Forge app is currently installed from the development environment on the production Atlassian site for demo purposes. Production release/install remains a packaging step if this becomes a real customer deployment.
