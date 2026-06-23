# ProxyTrace Evaluation Report

Generated: 2026-06-23T09:39:03+00:00

## Summary

- Traces evaluated: 20
- Replay determinism rate: 100.0%
- Side-effect blocking rate: 100.0%
- Divergence localization accuracy: 50.0%
- Judge agreement rate: 65.0%
- Semantic outcome accuracy: 64.7%
- Human-review rate: 5.0%
- Regression pass rate: 100.0%
- Gemini fallback rate: 5.0%
- AI-scored traces: 20/20
- Semantic-judged traces: 19/20

## Notes

- Synthetic observed traces and held-out references are generated from `proxytrace/data/labels.json`.
- Labels are removed before scorer and semantic-judge calls; they are read only afterward to calculate metrics.
- Replay determinism is measured by rerunning the fixture controller from recorded LLM decisions.
- Side-effect blocking is measured from actual SideEffectFirewall decisions, not tool-name presence.
- AI metrics are reported as N/A when Gemini is unavailable; fallback output is never counted as a correct verdict.

## Trace Results

| Trace | Failure Type | Human Verdict | Localized | Semantic Correct | Human Review | Confidence | Source |
|---|---|---:|---:|---:|---:|---:|---|
| T001 | clean_run | pass | yes | yes | no | 1.00 | gemini_structured_scorer |
| T002 | clean_run | pass | yes | yes | no | 1.00 | gemini_structured_scorer |
| T003 | clean_run | pass | yes | yes | no | 1.00 | gemini_structured_scorer |
| T004 | clean_run | pass | yes | yes | no | 1.00 | gemini_structured_scorer |
| T005 | clean_run | pass | yes | yes | no | 1.00 | gemini_structured_scorer |
| T006 | wrong_tool_argument | fail | no | n/a | yes | 0.95 | gemini_structured_scorer |
| T007 | wrong_tool_argument | fail | no | yes | no | 0.95 | gemini_structured_scorer |
| T008 | wrong_tool_argument | fail | yes | no | no | 0.95 | gemini_structured_scorer |
| T009 | wrong_tool_argument | fail | yes | yes | no | 0.95 | gemini_structured_scorer |
| T010 | wrong_tool_selection | fail | no | no | no | 0.95 | gemini_structured_scorer |
| T011 | wrong_tool_selection | fail | no | no | no | 0.95 | gemini_structured_scorer |
| T012 | wrong_tool_selection | fail | yes | yes | no | 0.95 | gemini_structured_scorer |
| T013 | wrong_tool_selection | fail | yes | no | no | 0.95 | gemini_structured_scorer |
| T014 | untrusted_context_injection | fail | no | no | no | 0.90 | gemini_structured_scorer |
| T015 | untrusted_context_injection | fail | no | yes | no | 0.95 | gemini_structured_scorer |
| T016 | untrusted_context_injection | fail | no | yes | no | 0.95 | gemini_structured_scorer |
| T017 | wrong_tool_order | fail | no | no | no | 0.95 | gemini_structured_scorer |
| T018 | wrong_tool_order | fail | no | yes | no | 0.95 | gemini_structured_scorer |
| T019 | schema_drift | warn | yes | n/a | no | 0.90 | gemini_structured_scorer |
| T020 | schema_drift | warn | no | n/a | no | 1.00 | gemini_structured_scorer |
