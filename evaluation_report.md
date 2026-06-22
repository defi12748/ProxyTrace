# ProxyTrace Evaluation Report

Generated: 2026-06-22T14:17:02+00:00

## Summary

- Traces evaluated: 20
- Replay determinism rate: 100.0%
- Side-effect blocking rate: 100.0%
- Divergence localization accuracy: N/A
- Judge agreement rate: N/A
- Semantic outcome accuracy: N/A
- Human-review rate: 100.0%
- Regression pass rate: 100.0%
- Gemini fallback rate: 100.0%
- AI-scored traces: 0/20
- Semantic-judged traces: 0/20

## Notes

- Synthetic observed traces and held-out references are generated from `proxytrace/data/labels.json`.
- Labels are removed before scorer and semantic-judge calls; they are read only afterward to calculate metrics.
- Replay determinism is measured by rerunning the fixture controller from recorded LLM decisions.
- Side-effect blocking is measured from actual SideEffectFirewall decisions, not tool-name presence.
- AI metrics are reported as N/A when Gemini is unavailable; fallback output is never counted as a correct verdict.

## Trace Results

| Trace | Failure Type | Human Verdict | Localized | Semantic Correct | Human Review | Confidence | Source |
|---|---|---:|---:|---:|---:|---:|---|
| T001 | clean_run | pass | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T002 | clean_run | pass | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T003 | clean_run | pass | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T004 | clean_run | pass | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T005 | clean_run | pass | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T006 | wrong_tool_argument | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T007 | wrong_tool_argument | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T008 | wrong_tool_argument | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T009 | wrong_tool_argument | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T010 | wrong_tool_selection | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T011 | wrong_tool_selection | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T012 | wrong_tool_selection | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T013 | wrong_tool_selection | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T014 | untrusted_context_injection | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T015 | untrusted_context_injection | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T016 | untrusted_context_injection | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T017 | wrong_tool_order | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T018 | wrong_tool_order | fail | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T019 | schema_drift | warn | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
| T020 | schema_drift | warn | n/a | n/a | yes | 0.00 | gemini_scorer_fallback |
