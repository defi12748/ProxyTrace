import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  GitBranch,
  RefreshCw,
  RotateCcw,
  Split,
  ChevronRight,
  ShieldAlert,
  BadgeCheck,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { Badge, statusColor } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { CopyId } from "../components/ui/CopyId";
import { Skeleton, SkeletonCard } from "../components/ui/Skeleton";
import { StepTimeline } from "../components/traces/StepTimeline";
import { StepInspector } from "../components/traces/StepInspector";
import { TrajectoryGraph } from "../components/traces/TrajectoryGraph";
import { StrictReplayCard } from "../components/replay/StrictReplayCard";
import { VerdictPanel } from "../components/replay/VerdictPanel";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { showToast } from "../components/ui/Toast";
import { DriftCheckModal } from "../components/drift/DriftCheckModal";
import { JiraIssueCard } from "../components/jira/JiraIssueCard";
import { ProxyTraceApi, getInitialApiBase, compactId, formatDate, asRecord } from "../api/client";
import { pickFirstToolStep, ROUTE_OPTIONS } from "../lib/utils";
import type {
  DriftCheckResult,
  ExploratoryReplay,
  JiraIssue,
  JsonObject,
  RunDetail,
  Step,
  StrictReplay,
  Warning,
} from "../api/types";
import { useIsMobile } from "../lib/useIsMobile";

export function TraceDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);
  const isMobile = useIsMobile();

  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [strictReplay, setStrictReplay] = useState<StrictReplay | null>(null);
  const [exploratoryReplay, setExploratoryReplay] = useState<ExploratoryReplay | null>(null);
  const [promotedId, setPromotedId] = useState<string | null>(null);
  const [patchBoard, setPatchBoard] = useState("PLATFORM");
  const [busy, setBusy] = useState<string | null>(null);
  const [driftModalOpen, setDriftModalOpen] = useState(false);

  const patchStep = useMemo(
    () => (detail ? pickFirstToolStep(detail.steps, "get_project_key") : null),
    [detail]
  );

  const patchedSteps = useMemo(() => {
    if (exploratoryReplay?.verdict.execution_status !== "completed") return [];
    const steps = exploratoryReplay?.verdict.patched_steps;
    return Array.isArray(steps) ? (steps as JsonObject[]) : [];
  }, [exploratoryReplay]);

  const selectedPreviousStep = useMemo(() => {
    if (!detail || !selectedStep) return undefined;
    const collection = selectedNodeId?.startsWith("p-")
      ? (patchedSteps as Step[])
      : detail.steps;
    const index = collection.findIndex((step) => step.step_index === selectedStep.step_index);
    return index > 0 ? collection[index - 1] : undefined;
  }, [detail, patchedSteps, selectedNodeId, selectedStep]);

  const loadDetail = useCallback(async () => {
    if (!runId) return;
    setBusy("load");
    try {
      const [d, w] = await Promise.all([
        api.get<RunDetail>(`/runs/${runId}`),
        api.get<{ warnings: Warning[] }>(`/runs/${runId}/warnings`),
      ]);
      setDetail(d);
      setWarnings(w.warnings);
      setSelectedStep(d.steps[0] ?? null);
      setSelectedNodeId(d.steps[0] ? `o-${d.steps[0].step_index}` : null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load run", "error");
    } finally {
      setBusy(null);
    }
  }, [api, runId]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  async function runStrict() {
    if (!runId) return;
    setBusy("strict");
    try {
      const r = await api.post<StrictReplay>(`/runs/${runId}/replay/strict`);
      setStrictReplay(r);
      showToast("Safe replay complete", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Replay failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function runExploratory() {
    if (!runId || patchStep === null) return;
    setBusy("exploratory");
    setExploratoryReplay(null);
    setPromotedId(null);
    try {
      const r = await api.post<ExploratoryReplay>(
        `/runs/${runId}/replay/exploratory`,
        {
          patch_step: patchStep,
          patch: {
            patch_type: "tool_result_patch",
            value: {
              response: {
                project_key: patchBoard,
                confidence: 0.97,
                evidence: ["frontend_patch"],
              },
            },
            note: `Frontend patch routed get_project_key to ${patchBoard}.`,
          },
        }
      );
      setExploratoryReplay(r);
      if (r.verdict.execution_status === "failed") {
        const executionError = asRecord(r.verdict.execution_error);
        showToast(String(executionError.message ?? "Simulation could not complete"), "error");
      } else {
        showToast("Route simulation complete", "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Simulation failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function promote() {
    if (!exploratoryReplay || exploratoryReplay.verdict.execution_status !== "completed") return;
    setBusy("promote");
    try {
      await api.post("/regression/promote", { replay_id: exploratoryReplay.replay_id });
      setPromotedId(exploratoryReplay.replay_id);
      showToast("Saved as regression test", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Promotion failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function runDriftCheck(): Promise<DriftCheckResult> {
    const r = await api.post<DriftCheckResult>(`/runs/${runId}/drift/check-all`);
    showToast("Drift check complete", "success");
    return r;
  }

  async function fetchJiraIssue(issueKey: string): Promise<JiraIssue> {
    const r = await api.get<{ issue: JiraIssue }>(`/jira/issues/${issueKey}`);
    return r.issue;
  }

  if (!detail && busy === "load") {
    return (
      <PageShell title={<Skeleton width="200px" height="28px" />}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "260px 1fr 320px", gap: "12px", height: isMobile ? "auto" : "calc(100vh - 220px)" }}>
          <SkeletonCard rows={10} />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <SkeletonCard rows={5} />
            <SkeletonCard rows={4} />
          </div>
          <SkeletonCard rows={8} />
        </div>
      </PageShell>
    );
  }

  if (!detail) {
    return (
      <PageShell title="Trace not found">
        <EmptyState icon={<GitBranch size={22} />} title="Run not found" description="This run ID does not exist." />
      </PageShell>
    );
  }

  const run = detail.run;

  // Calculate step type counts for subtitle
  const stepCounts = detail.steps.reduce((acc, s) => {
    acc[s.step_type] = (acc[s.step_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const subtitleContent = (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
      <span>{detail.step_count} steps</span>
      <span style={{ color: "var(--border-strong)" }}>·</span>
      <span>Started {formatDate(run.started_at)}</span>
      <span style={{ color: "var(--border-strong)" }}>·</span>
      <div style={{ display: "flex", gap: "6px" }}>
        {Object.entries(stepCounts).map(([type, count]) => (
          <Badge key={type} color={statusColor(type)}>{count}× {type}</Badge>
        ))}
      </div>
    </div>
  );

  const titleContent = (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Link to="/traces" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Traces</Link>
      <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
      <span>{run.jira_issue_key ?? <CopyId value={run.run_id} display={compactId(run.run_id)} />}</span>
      {selectedStep && (
        <>
          <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: "16px", color: "var(--text-muted)" }}>Step {selectedStep.step_index}</span>
        </>
      )}
    </div>
  );

  return (
    <PageShell
      title={titleContent}
      subtitle={subtitleContent}
      actions={
        <div style={{ display: "flex", gap: "8px", flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate("/traces")}>
            Back
          </Button>
          <Button variant="ghost" icon={<RefreshCw size={14} />} loading={busy === "load"} onClick={() => void loadDetail()}>
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<ShieldAlert size={13} />}
            onClick={() => setDriftModalOpen(true)}
          >
            Re-evaluate Drift
          </Button>
          <Badge color={statusColor(run.status)}>{run.status}</Badge>
        </div>
      }
    >
      {/* Three-panel workspace */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "260px 1fr 320px",
          gap: "12px",
          height: isMobile ? "auto" : "calc(100vh - 220px)",
          minHeight: isMobile ? "auto" : "500px",
        }}
      >
        {/* Left: Timeline */}
        <Card id="tour-trace-timeline" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <CardHeader>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "2px" }}>
                Steps
              </div>
              <h2 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>Timeline</h2>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{detail.step_count}</span>
          </CardHeader>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <StepTimeline
              steps={detail.steps}
              selectedStepId={selectedNodeId?.startsWith("o-") ? selectedStep?.step_id ?? null : null}
              warnings={warnings}
              onSelect={(stepId) => {
                const step = detail.steps.find((item) => item.step_id === stepId) ?? null;
                setSelectedStep(step);
                setSelectedNodeId(step ? `o-${step.step_index}` : null);
              }}
            />
          </div>
        </Card>

        {/* Center: interactive trajectory */}
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <Card id="tour-trajectory-graph" style={{ height: isMobile ? "440px" : "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <CardHeader style={{ paddingTop: "10px", paddingBottom: "10px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>Trajectory Graph</div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {patchedSteps.length > 0 ? "Original ↔ Simulated · drag nodes · click to inspect" : "Drag nodes · click to inspect"}
              </span>
            </CardHeader>
            <div style={{ flex: 1, minHeight: 0 }}>
              <TrajectoryGraph
                steps={detail.steps}
                patchedSteps={patchedSteps}
                patchStep={patchStep}
                selectedNodeId={selectedNodeId}
                onSelectNode={(selection) => {
                  setSelectedNodeId(selection.nodeId);
                  setSelectedStep(selection.step as Step);
                }}
              />
            </div>
          </Card>
        </div>

        {/* Right: Actions panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: isMobile ? "visible" : "auto" }}>
          {/* Replay controls */}
          <Card id="tour-replay-controls">
            <CardHeader>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "2px" }}>
                  Actions
                </div>
                <h2 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>Replay Controls</h2>
              </div>
            </CardHeader>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px 0", lineHeight: 1.5 }}>
                  Re-run this trace with side-effects disabled to test if the agent is deterministic.
                </p>
                <Button
                  variant="primary"
                  icon={<RotateCcw size={14} />}
                  loading={busy === "strict"}
                  onClick={() => void runStrict()}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Safe Replay
                </Button>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Simulate Route
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                  {ROUTE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      id={`board-${opt.value.toLowerCase()}`}
                      onClick={() => setPatchBoard(opt.value)}
                      style={{
                        padding: "7px 8px",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${patchBoard === opt.value ? "rgba(99,179,237,0.4)" : "var(--border)"}`,
                        background: patchBoard === opt.value ? "var(--cyan-dim)" : "var(--bg-raised)",
                        color: patchBoard === opt.value ? "var(--cyan)" : "var(--text-secondary)",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all var(--transition)",
                        textAlign: "center",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px 0", lineHeight: 1.5 }}>
                  Inject a mock response into the selected step to see if the agent recovers or changes its path.
                </p>
                <Button
                  variant="primary"
                  icon={<Split size={14} />}
                  loading={busy === "exploratory"}
                  onClick={() => void runExploratory()}
                  disabled={patchStep === null}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Simulate Route
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card id="tour-step-inspector">
            <CardHeader>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "2px" }}>
                  Selected node
                </div>
                <h2 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>
                  {selectedStep ? `Step ${selectedStep.step_index}` : "No step selected"}
                </h2>
              </div>
              {selectedStep && (
                <div style={{ display: "flex", gap: "5px" }}>
                  {selectedNodeId?.startsWith("p-") && <Badge color="purple">simulated</Badge>}
                  <Badge color={statusColor(selectedStep.step_type)}>{selectedStep.step_type}</Badge>
                </div>
              )}
            </CardHeader>
            <CardBody>
              {selectedStep ? (
                <StepInspector step={selectedStep} previousStep={selectedPreviousStep} />
              ) : (
                <EmptyState icon={<GitBranch size={20} />} title="Select a node" description="Click any graph node or timeline step." />
              )}
            </CardBody>
          </Card>

          {/* Strict replay result */}
          {strictReplay && <StrictReplayCard replay={strictReplay} />}

          {/* Exploratory verdict */}
          {exploratoryReplay && <VerdictPanel replay={exploratoryReplay} />}

          {exploratoryReplay?.verdict.execution_status === "completed" && (
            promotedId ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px", background: "var(--emerald-dim)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "var(--radius-md)", color: "var(--emerald)", fontSize: "12px", fontWeight: 600 }}>
                <BadgeCheck size={14} /> Saved as regression test
              </div>
            ) : (
              <Button
                variant="success"
                icon={<BadgeCheck size={14} />}
                loading={busy === "promote"}
                onClick={() => void promote()}
                style={{ width: "100%", justifyContent: "center" }}
              >
                Promote to Regression Test
              </Button>
            )
          )}

          {/* Jira issue card — shown when the run has a linked Jira key */}
          {run.jira_issue_key && (
            <JiraIssueCard
              issueKey={run.jira_issue_key}
              onFetch={fetchJiraIssue}
            />
          )}
        </div>
      </div>

      {/* Drift Check Modal */}
      {runId && (
        <DriftCheckModal
          isOpen={driftModalOpen}
          onClose={() => setDriftModalOpen(false)}
          runId={runId}
          onRun={runDriftCheck}
        />
      )}
    </PageShell>
  );
}
