import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Database,
  GitBranch,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Split
} from "lucide-react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ProxyTraceApi,
  asRecord,
  compactId,
  formatDate,
  type ExploratoryReplay,
  type JsonObject,
  type RegressionItem,
  type RegressionRunResult,
  type Run,
  type RunDetail,
  type Step,
  type StrictReplay,
  type Warning
} from "./api";

const DEFAULT_API_BASE =
  import.meta.env.VITE_PROXYTRACE_API_URL || "http://127.0.0.1:8000";

const ROUTE_OPTIONS = [
  { value: "PLATFORM", label: "Platform" },
  { value: "SECURITY", label: "Customer Security" },
  { value: "BILLING", label: "Billing" },
  { value: "INFRA", label: "Infrastructure" }
];

function getInitialApiBase(): string {
  const saved = localStorage.getItem("proxytrace_api_base") || DEFAULT_API_BASE;
  const legacyHost = ["local", "host"].join("");
  try {
    const parsed = new URL(saved);
    if (parsed.hostname === legacyHost) {
      parsed.hostname = "127.0.0.1";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_API_BASE;
  }
}

function stepName(step: Step | JsonObject): string {
  const payload = asRecord(step.payload);
  if (step.step_type === "tool") {
    return String(payload.tool_name ?? "tool_call");
  }
  return String(payload.model ?? "llm_snapshot");
}

function stepSubtitle(step: Step | JsonObject): string {
  const payload = asRecord(step.payload);
  if (step.step_type === "tool") {
    const params = asRecord(payload.params);
    const response = asRecord(payload.response);
    return String(
      params.board ??
        response.board ??
        response.project_key ??
        payload.status ??
        "recorded"
    );
  }
  return String(payload.prompt_hash ?? payload.status ?? "captured");
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function pickFirstToolStep(steps: Step[], toolName: string): number | null {
  const step = steps.find(
    (item) =>
      item.step_type === "tool" &&
      String(asRecord(item.payload).tool_name) === toolName
  );
  return step?.step_index ?? null;
}

function confidenceLabel(value: unknown): string {
  if (typeof value !== "number") return "pending";
  return `${Math.round(value * 100)}%`;
}

function buildGraph(
  steps: Step[],
  patchedSteps: JsonObject[],
  patchStep: number | null
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const hasPatch = patchedSteps.length > 0;

  steps.forEach((step, index) => {
    const isPatchPoint = step.step_index === patchStep;
    nodes.push({
      id: `o-${step.step_index}`,
      position: { x: 20, y: index * 96 },
      data: {
        label: (
          <div className="flow-node">
            <strong>{step.step_index}. {stepName(step)}</strong>
            <span>{stepSubtitle(step)}</span>
          </div>
        )
      },
      className: isPatchPoint ? "node original patch-point" : "node original"
    });
    if (index > 0) {
      edges.push({
        id: `oe-${steps[index - 1].step_index}-${step.step_index}`,
        source: `o-${steps[index - 1].step_index}`,
        target: `o-${step.step_index}`,
        type: "smoothstep"
      });
    }
  });

  if (hasPatch) {
    patchedSteps.forEach((step, index) => {
      const stepIndex = Number(step.step_index ?? index + 1);
      const isPatchPoint = stepIndex === patchStep;
      const isUnverified = Boolean(step.unverified);
      nodes.push({
        id: `p-${stepIndex}`,
        position: { x: 430, y: index * 96 },
        data: {
          label: (
            <div className="flow-node">
              <strong>{stepIndex}. {stepName(step)}</strong>
              <span>{isUnverified ? "unverified patch path" : stepSubtitle(step)}</span>
            </div>
          )
        },
        className: [
          "node",
          "patched",
          isPatchPoint ? "patch-point" : "",
          isUnverified ? "unverified" : ""
        ].join(" ")
      });
      if (index > 0) {
        const previous = Number(patchedSteps[index - 1].step_index ?? index);
        edges.push({
          id: `pe-${previous}-${stepIndex}`,
          source: `p-${previous}`,
          target: `p-${stepIndex}`,
          type: "smoothstep",
          animated: isUnverified
        });
      }
    });

    if (patchStep !== null) {
      edges.push({
        id: `patch-${patchStep}`,
        source: `o-${patchStep}`,
        target: `p-${patchStep}`,
        type: "smoothstep",
        animated: true,
        className: "patch-edge"
      });
    }
  }

  return { nodes, edges };
}

export function App() {
  const [apiBase] = useState(getInitialApiBase);
  const [issueFilter, setIssueFilter] = useState("");
  const [traceIssueKey, setTraceIssueKey] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [regressions, setRegressions] = useState<RegressionItem[]>([]);
  const [strictReplay, setStrictReplay] = useState<StrictReplay | null>(null);
  const [exploratoryReplay, setExploratoryReplay] =
    useState<ExploratoryReplay | null>(null);
  const [regressionResult, setRegressionResult] =
    useState<RegressionRunResult | null>(null);
  const [patchBoard, setPatchBoard] = useState("PLATFORM");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("Ready");
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => new ProxyTraceApi(apiBase.replace(/\/$/, "")), [apiBase]);

  const selectedStep = useMemo(() => {
    if (!detail) return null;
    return (
      detail.steps.find((step) => step.step_id === selectedStepId) ??
      detail.steps[0] ??
      null
    );
  }, [detail, selectedStepId]);

  const patchStep = useMemo(
    () => (detail ? pickFirstToolStep(detail.steps, "get_project_key") : null),
    [detail]
  );

  const patchedSteps = useMemo(() => {
    const steps = exploratoryReplay?.verdict.patched_steps;
    return Array.isArray(steps) ? (steps as JsonObject[]) : [];
  }, [exploratoryReplay]);

  const graph = useMemo(
    () => buildGraph(detail?.steps ?? [], patchedSteps, patchStep),
    [detail, patchStep, patchedSteps]
  );

  const driftWarnings = warnings.filter((warning) =>
    warning.warning_type.includes("drift")
  );

  const loadRuns = useCallback(async () => {
    const query = issueFilter.trim()
      ? `?jira_issue_key=${encodeURIComponent(issueFilter.trim())}&limit=50`
      : "?limit=50";
    const response = await api.get<{ runs: Run[] }>(`/runs${query}`);
    setRuns(response.runs);
    if (!selectedRunId && response.runs[0]) {
      setSelectedRunId(response.runs[0].run_id);
    }
  }, [api, issueFilter, selectedRunId]);

  const loadRunDetail = useCallback(
    async (runId: string) => {
      const [runDetail, warningResponse] = await Promise.all([
        api.get<RunDetail>(`/runs/${runId}`),
        api.get<{ warnings: Warning[] }>(`/runs/${runId}/warnings`)
      ]);
      setDetail(runDetail);
      setWarnings(warningResponse.warnings);
      setSelectedStepId(runDetail.steps[0]?.step_id ?? null);
    },
    [api]
  );

  const loadRegressions = useCallback(async () => {
    const response = await api.get<{ regressions: RegressionItem[] }>(
      "/regression?limit=50"
    );
    setRegressions(response.regressions);
  }, [api]);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    setError(null);
    try {
      await Promise.all([loadRuns(), loadRegressions()]);
      setNotice("Synchronized");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [loadRegressions, loadRuns]);

  useEffect(() => {
    localStorage.setItem("proxytrace_api_base", apiBase);
  }, [apiBase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null);
      return;
    }
    setStrictReplay(null);
    setExploratoryReplay(null);
    setRegressionResult(null);
    setBusy("detail");
    setError(null);
    loadRunDetail(selectedRunId)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(null));
  }, [loadRunDetail, selectedRunId]);

  async function traceJiraIssue() {
    const issueKey = traceIssueKey.trim().toUpperCase();
    if (!issueKey) {
      setError("Enter a Jira issue key first.");
      return;
    }
    setBusy("jira");
    setError(null);
    try {
      const response = await api.post<{ run_id: string }>("/jira/trace", {
        issue_key: issueKey
      });
      setSelectedRunId(response.run_id);
      await loadRuns();
      await loadRegressions();
      setNotice(`Trace recorded for ${issueKey}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function runStrictReplay() {
    if (!selectedRunId) return;
    setBusy("strict");
    setError(null);
    try {
      const response = await api.post<StrictReplay>(
        `/runs/${selectedRunId}/replay/strict`
      );
      setStrictReplay(response);
      await loadRunDetail(selectedRunId);
      setNotice("Strict replay complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function runPatchReplay() {
    if (!selectedRunId || patchStep === null) return;
    setBusy("patch");
    setError(null);
    try {
      const response = await api.post<ExploratoryReplay>(
        `/runs/${selectedRunId}/replay/exploratory`,
        {
          patch_step: patchStep,
          patch: {
            patch_type: "tool_result_patch",
            value: {
              response: {
                project_key: patchBoard,
                confidence: 0.97,
                evidence: ["frontend_patch"]
              }
            },
            note: `Frontend patch routed get_project_key to ${patchBoard}.`
          }
        }
      );
      setExploratoryReplay(response);
      setNotice("Exploratory replay complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function promoteRegression() {
    if (!exploratoryReplay) return;
    setBusy("promote");
    setError(null);
    try {
      await api.post("/regression/promote", {
        replay_id: exploratoryReplay.replay_id
      });
      await loadRegressions();
      setNotice("Regression promoted");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function runRegressionPack() {
    setBusy("regression");
    setError(null);
    try {
      const response = await api.post<RegressionRunResult>("/regression/run-all");
      setRegressionResult(response);
      await loadRegressions();
      setNotice("Regression pack checked");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const evaluation = asRecord(exploratoryReplay?.verdict.evaluation);
  const semanticJudgment = asRecord(evaluation.semantic_judgment);
  const deterministic = asRecord(evaluation.deterministic_verdict);
  const strictVerdict = strictReplay?.verdict;
  const strictDeterminism =
    typeof strictVerdict?.determinism_rate === "number"
      ? strictVerdict.determinism_rate
      : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img className="brand-mark" src="/vectors-logo.jfif" alt="Vectors" />
          <div>
            <p className="brand-kicker">Vectors Software</p>
            <h1>ProxyTrace Replay Console</h1>
            <p>Trace, replay, patch, and promote Jira agent runs.</p>
          </div>
        </div>

        <div className="top-actions">
          <div className="issue-trigger">
            <input
              value={traceIssueKey}
              onChange={(event) => setTraceIssueKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void traceJiraIssue();
                }
              }}
              placeholder="SCRUM-1"
              aria-label="Jira issue key"
            />
            <button
              className="primary-button"
              onClick={traceJiraIssue}
              disabled={busy !== null}
            >
              <Play size={16} />
              Trace Issue
            </button>
          </div>
          <button className="icon-button" onClick={refresh} disabled={busy !== null}>
            <RefreshCw size={16} />
            Sync
          </button>
        </div>
      </header>

      {(error || (notice && notice !== "Ready")) && (
        <section className={error ? "notice error" : "notice"}>
          <span>{error ?? notice}</span>
          {busy && <strong>{busy}</strong>}
        </section>
      )}

      <section className="metric-row">
        <Metric
          icon={<Database size={18} />}
          label="Steps"
          value={String(detail?.step_count ?? 0)}
        />
        <Metric
          icon={<ShieldCheck size={18} />}
          label="Live Calls"
          value={String(strictVerdict?.live_call_count ?? "pending")}
        />
        <Metric
          icon={<Activity size={18} />}
          label="Determinism"
          value={strictDeterminism === null ? "pending" : confidenceLabel(strictDeterminism)}
        />
        <Metric
          icon={<AlertTriangle size={18} />}
          label="Drift"
          value={String(driftWarnings.length)}
        />
        <Metric
          icon={<BadgeCheck size={18} />}
          label="Regressions"
          value={String(regressions.length)}
        />
      </section>

      <section className="workspace">
        <aside className="panel runs-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Runs</p>
              <h2>Trace List</h2>
            </div>
            <input
              className="compact-input"
              value={issueFilter}
              onChange={(event) => setIssueFilter(event.target.value)}
              placeholder="Issue key"
              aria-label="Filter by Jira issue key"
            />
          </div>

          <div className="run-list">
            {runs.map((run) => (
              <button
                key={run.run_id}
                className={
                  selectedRunId === run.run_id ? "run-item active" : "run-item"
                }
                onClick={() => setSelectedRunId(run.run_id)}
              >
                <span className={`status-dot ${run.status}`} />
                <span>
                  <strong>{run.jira_issue_key ?? "No issue"}</strong>
                  <small>{compactId(run.run_id)} · {formatDate(run.started_at)}</small>
                </span>
              </button>
            ))}
            {runs.length === 0 && (
              <div className="empty-state">
                <Database size={18} />
                <span>No traces loaded</span>
              </div>
            )}
          </div>
        </aside>

        <section className="panel timeline-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>{detail?.run.jira_issue_key ?? "No run selected"}</h2>
            </div>
            <div className="segmented">
              <button onClick={runStrictReplay} disabled={!detail || busy !== null}>
                <RotateCcw size={15} />
                Strict
              </button>
              <button onClick={runPatchReplay} disabled={!detail || busy !== null}>
                <Split size={15} />
                What-if
              </button>
            </div>
          </div>

          <div className="timeline">
            {(detail?.steps ?? []).map((step) => (
              <button
                key={step.step_id}
                className={
                  selectedStep?.step_id === step.step_id
                    ? "timeline-step active"
                    : "timeline-step"
                }
                onClick={() => setSelectedStepId(step.step_id)}
              >
                <span className={`step-index ${step.step_type}`}>{step.step_index}</span>
                <span className="step-main">
                  <strong>{stepName(step)}</strong>
                  <small>{stepSubtitle(step)}</small>
                </span>
                <span className="step-type">{step.step_type}</span>
              </button>
            ))}
          </div>

          <div className="graph-panel">
            <div className="graph-header">
              <span>Original</span>
              {patchedSteps.length > 0 && <span>Patched</span>}
            </div>
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              fitView
              minZoom={0.45}
              maxZoom={1.4}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={18} size={1} />
              <Controls />
            </ReactFlow>
          </div>
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Inspector</p>
              <h2>{selectedStep ? `Step ${selectedStep.step_index}` : "No Step"}</h2>
            </div>
            <span className="badge">{selectedStep?.step_type ?? "idle"}</span>
          </div>

          {selectedStep ? (
            <>
              <JsonBlock title="Payload" value={selectedStep.payload} />
              <JsonBlock title="Snapshot" value={selectedStep.snapshot} />
            </>
          ) : (
            <div className="empty-state">
              <GitBranch size={18} />
              <span>Select a recorded step</span>
            </div>
          )}

          <section className="action-block">
            <div className="block-heading">
              <Sparkles size={16} />
              <span>What-if Route</span>
            </div>
            <div className="board-picker">
              {ROUTE_OPTIONS.map((board) => (
                <button
                  key={board.value}
                  className={patchBoard === board.value ? "board active" : "board"}
                  onClick={() => setPatchBoard(board.value)}
                >
                  {board.label}
                </button>
              ))}
            </div>
            <button
              className="primary-button wide"
              onClick={runPatchReplay}
              disabled={!detail || patchStep === null || busy !== null}
            >
              <Split size={16} />
              Run What-if Replay
            </button>
          </section>

          <section className="action-block">
            <div className="block-heading">
              <BadgeCheck size={16} />
              <span>Regression</span>
            </div>
            <div className="button-row">
              <button
                onClick={promoteRegression}
                disabled={!exploratoryReplay || busy !== null}
              >
                Promote
              </button>
              <button onClick={runRegressionPack} disabled={busy !== null}>
                Run All
              </button>
            </div>
          </section>
        </aside>
      </section>

      <section className="lower-grid">
        <ResultPanel
          title="Strict Replay"
          value={{
            replay_id: strictReplay?.replay_id,
            determinism_rate: strictVerdict?.determinism_rate,
            live_call_count: strictVerdict?.live_call_count,
            side_effect_block_count: strictVerdict?.side_effect_block_count,
            safety_guarantee: strictVerdict?.safety_guarantee
          }}
        />
        <ResultPanel
          title="Divergence Report"
          value={{
            replay_id: exploratoryReplay?.replay_id,
            root_cause_step: evaluation.root_cause_step,
            divergence_type: evaluation.divergence_type,
            risk_level: evaluation.risk_level ?? deterministic.risk_level,
            judge_confidence: evaluation.judge_confidence,
            human_review_required: evaluation.human_review_required,
            ai_load_bearing: evaluation.ai_load_bearing,
            semantic_judgment: semanticJudgment
          }}
        />
        <ResultPanel
          title="Warnings"
          value={{
            total: warnings.length,
            drift: driftWarnings.length,
            warnings
          }}
        />
        <ResultPanel
          title="Regression Pack"
          value={{
            promoted: regressions.length,
            last_result: regressionResult,
            regressions: regressions.slice(0, 5)
          }}
        />
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="json-block">
      <div className="block-heading">
        <span>{title}</span>
      </div>
      <pre>{jsonText(value)}</pre>
    </section>
  );
}

function ResultPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="panel result-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Report</p>
          <h2>{title}</h2>
        </div>
      </div>
      <pre>{jsonText(value)}</pre>
    </section>
  );
}
