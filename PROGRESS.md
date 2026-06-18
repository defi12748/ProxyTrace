# ProxyTrace Progress

Last verified: 2026-06-18, Africa/Lagos.

Source of truth: `ProxyTrace_WinningPlan (3).docx`.

Important override: the docx names a different scorer provider in examples, but the project instruction is to use Gemini. The repo now uses `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.1-flash-lite`.

## Alignment Verdict

We are aligned with the docx direction and Use Case 2 architecture, but we are not 100% complete against the full judging gate yet.

The current highest-scoring risk is the global requirement that AI must be the mechanism, not a peripheral feature. ProxyTrace now captures and replays AI-agent behavior, uses Gemini for structured divergence verdicts, and adds a Gemini semantic outcome judge that produces assertion candidates for regression promotion. The remaining proof work is to validate that semantic judge on the labeled trace set and report its confidence / human-review behavior.

## Completion Estimate

Overall docx plan: about 38% complete.

Phase 1 foundation code: about 78% complete.

Phase 1 gate proof: about 68% complete, because the code path has now been proven with Neon, 5 demo traces, and one live Gemini-patched LLM capture run, but not yet with Render, Forge Remote, or real Jira tools.

Breakdown:

- Day 0 infrastructure: about 45%; Neon schema init is verified, Render config exists, but Render deploy and Forge spike are not connected yet.
- Phase 1 recording/proxy/replay/firewall: about 78%; core backend modules exist, 5 Neon-backed demo traces replayed, and Gemini SDK capture was verified, but real Atlassian verification is still missing.
- Phase 2 patch/diff/evaluator/regression: about 90%; patch engine, exploratory replay, divergence diff, Gemini structured scorer, hybrid evaluator, regression promotion, and run-all exist. Remaining work is hardening and broader route-level tests.
- Phase 3 frontend/Forge UI: 0%; not started.
- Phase 4 evaluation/polish: about 10%; labels exist, but trace generation and metrics are not implemented.

Judging-risk adjustment: the engineering foundation is strong, but first-place positioning depends on proving that AI is load-bearing in the replay/evaluation mechanism. Semantic outcome judging is now implemented; evaluation proof should happen before major frontend polish.

What is aligned:

- Stack direction: Python, FastAPI, React later, Neon PostgreSQL, Render, Forge.
- Core product loop: record -> replay -> patch -> diff -> explain -> regress.
- Phase 1 priority: record, strict replay, side-effect firewall before frontend.
- Demo-agent order: agent first, proxy second.
- Tool model: `get_project_key` is read-only, `update_ticket` is side-effecting write.
- Data model direction: runs, steps, tool contracts, replays, regression pack, drift warnings.
- Evaluation labels exist before scorer work.
- Data sensitivity is now handled in capture paths with default redaction before persistence.

What is not fully proven yet:

- Render deployment has not been performed or health-checked from a public URL.
- Forge Day 0 spike has not been scaffolded/deployed.
- The demo agent has not been run against a real Atlassian developer workspace.
- Alembic migrations are not added yet; `proxytrace.db.init_db` creates tables directly for the foundation.
- Gemini semantic outcome judgment is implemented, but it has not yet been validated across the 20-trace evaluation set.

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
- `proxytrace/contracts/registry.py` - default tool contracts.
- `proxytrace/db/models.py` - Neon/PostgreSQL table models.
- `proxytrace/data/labels.json` - 20 human labels for evaluation.

## Next Work

### Immediate Judging Alignment Work

1. Generate the 20 synthetic traces from `proxytrace/data/labels.json`.
2. Run the Gemini scorer and semantic outcome judge against those traces.
3. Report confidence, human-review rate, semantic outcome accuracy, and judge agreement in `evaluation_report.md`.
4. Add low-confidence semantic judge fixtures for incomplete evidence.

### Immediate Deploy / Integration Gate Work

1. Deploy FastAPI backend to Render.
2. Add Render env vars:
   - `DATABASE_URL`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL=gemini-3.1-flash-lite`
   - `REDACTION_ENABLED=true`
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

1. Validate semantic expected outcomes and assertion candidates against the labeled trace set.
2. Add route-level tests for regression endpoints.
3. Add replay lookup endpoints if the frontend needs direct replay history.
4. Add deeper malformed-scorer fixtures and low-confidence demo trace.
5. Harden regression run-all to support future live patched-agent reruns, not only frozen assertion checks.

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

- Semantic outcome judgment exists, but we still need evaluation evidence that it improves failure attribution and regression assertions.
- No Render deployment yet means Forge Remote cannot call the backend yet.
- No Forge spike yet means commercial integration is not proven.
- No real Jira workspace run yet means the current demo agent is still a local proxy proof.
- Regression runner currently validates frozen trace consistency and final-state assertions. It does not yet re-execute a fresh agent version against the frozen assertions.
- Redaction covers common PII/secret patterns but still needs an evaluation note describing scope and limitations.
- Gemini model name is set to `gemini-3.1-flash-lite`; if the provider exposes a different canonical ID, update env only.
