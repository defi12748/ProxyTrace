import { useEffect, useState, useMemo } from "react";
import { Database, RotateCcw, Split, ExternalLink, Zap, Brain, BadgeCheck, Activity, ChevronDown, ChevronRight, Play, AlertTriangle } from "lucide-react";
import { ProxyTraceApi, getInitialApiBase } from "../api/client";
import type { Run, RunDetail, StrictReplay, ExploratoryReplay, JsonObject, Step } from "../api/types";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { StrictReplayCard } from "../components/replay/StrictReplayCard";
import { VerdictPanel } from "../components/replay/VerdictPanel";
import { EmptyState } from "../components/ui/EmptyState";
import { WorkflowGraph } from "../components/traces/WorkflowGraph";
import { StepInspector } from "../components/traces/StepInspector";
import { showToast } from "../components/ui/Toast";
import { stepName, stepSubtitle, pickFirstToolStep, ROUTE_OPTIONS } from "../lib/utils";



export function JiraPanelApp() {
  const [issueKey, setIssueKey] = useState<string | null>(null);
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase.replace(/\/$/, "")), [apiBase]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  
  const [strictReplay, setStrictReplay] = useState<StrictReplay | null>(null);
  const [exploratoryReplay, setExploratoryReplay] = useState<ExploratoryReplay | null>(null);
  const [promotedId, setPromotedId] = useState<string | null>(null);

  const [patchBoard, setPatchBoard] = useState("PLATFORM");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [timelineMode, setTimelineMode] = useState<"original" | "simulated">("original");

  const patchStep = useMemo(
    () => (detail ? pickFirstToolStep(detail.steps, "get_project_key") : null),
    [detail]
  );

  const patchedSteps = useMemo(() => {
    const steps = exploratoryReplay?.verdict.patched_steps;
    return Array.isArray(steps) ? (steps as JsonObject[]) : [];
  }, [exploratoryReplay]);

  // 1. Get Jira Context
  useEffect(() => {
    // Skip Forge import completely if running locally
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
      console.log("Running locally, skipping @forge/bridge");
      setIssueKey("SCRUM-1");
      return;
    }

    import("@forge/bridge")
      .then(({ view }) => {
        view
          .getContext()
          .then((context) => {
            const key = (context as { extension?: { issue?: { key?: string } } })?.extension?.issue?.key;
            if (key) {
              setIssueKey(key);
            } else {
              setIssueKey("SCRUM-1"); 
            }
          })
          .catch(() => {
            setIssueKey("SCRUM-1");
          });
      })
      .catch((err) => {
        console.warn("Not running in Forge:", err);
        setIssueKey("SCRUM-1");
      });
  }, []);

  const [runs, setRuns] = useState<Run[]>([]);

  // 2. Load latest trace for this issue
  useEffect(() => {
    if (!issueKey) return;
    
    async function loadData() {
      setLoading(true);
      try {
        const response = await api.get<{ runs: Run[] }>(`/runs?jira_issue_key=${issueKey}&limit=10`);
        setRuns(response.runs);
        const latestRun = response.runs[0];
        if (latestRun) {
          setRun(latestRun);
          const runDetail = await api.get<RunDetail>(`/runs/${latestRun.run_id}`);
          setDetail(runDetail);
        }
      } catch (err) {
        console.error("Failed to load trace", err);
      } finally {
        setLoading(false);
      }
    }
    
    void loadData();
  }, [issueKey, api]);

  async function loadRunDetail(selectedRun: Run) {
    setRun(selectedRun);
    setDetail(null);
    setStrictReplay(null);
    setExploratoryReplay(null);
    try {
      const runDetail = await api.get<RunDetail>(`/runs/${selectedRun.run_id}`);
      setDetail(runDetail);
    } catch (err) {
      console.error(err);
    }
  }

  // Actions
  async function runSafeReplay() {
    if (!run) return;
    setBusy("strict");
    setExploratoryReplay(null);
    try {
      const response = await api.post<StrictReplay>(`/runs/${run.run_id}/replay/strict`);
      setStrictReplay(response);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Replay failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function runExploratory() {
    if (!run || patchStep === null) return;
    setBusy("exploratory");
    setStrictReplay(null);
    setPromotedId(null);
    try {
      const r = await api.post<ExploratoryReplay>(`/runs/${run.run_id}/replay/exploratory`, {
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
      });
      setExploratoryReplay(r);
      showToast("Route simulation complete", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Simulation failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function promote() {
    if (!exploratoryReplay) return;
    setBusy("promote");
    try {
      await api.post("/regression/promote", { replay_id: exploratoryReplay.replay_id });
      setPromotedId(exploratoryReplay.replay_id);
      showToast("Saved as regression test", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Promote failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function traceIssue() {
    if (!issueKey) return;
    setBusy("trace");
    try {
      await api.post<{ run_id: string }>("/jira/trace", { issue_key: issueKey });
      showToast(`Trace started for ${issueKey}`, "success");
      
      // Reload runs
      setLoading(true);
      const res = await api.get<{ runs: Run[] }>(`/runs?jira_issue_key=${issueKey}`);
      if (res.runs.length > 0) {
        setRuns(res.runs);
        setRun(res.runs[0]);
        await loadRunDetail(res.runs[0]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Trace failed", "error");
    } finally {
      setBusy(null);
      setLoading(false);
    }
  }

  function openFullApp() {
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
      window.open(apiBase || "https://proxytrace.onrender.com", "_blank");
      return;
    }

    import("@forge/bridge")
      .then(({ router }) => {
        router.open(apiBase || "https://proxytrace.onrender.com").catch(() => {
          window.open(apiBase || "https://proxytrace.onrender.com", "_blank");
        });
      })
      .catch(() => {
        window.open(apiBase || "https://proxytrace.onrender.com", "_blank");
      });
  }

  if (loading) {
    return (
      <div style={{ padding: "20px", display: "flex", justifyContent: "center" }}>
        <div style={{ animation: "pulse 1.5s infinite" }}>Loading trace data...</div>
      </div>
    );
  }

  if (!run || !detail) {
    return (
      <div style={{ padding: "16px" }}>
        <EmptyState
          icon={<Split size={24} />}
          title="No Traces Found"
          description={`Agent has not processed ${issueKey || "this issue"} yet.`}
        />
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <Button 
            variant="primary" 
            icon={<Play size={14} />} 
            loading={busy === "trace"} 
            onClick={() => void traceIssue()} 
            style={{ width: "100%", justifyContent: "center" }}
            disabled={!issueKey}
          >
            Trigger Trace Now
          </Button>
          <Button variant="ghost" onClick={openFullApp} style={{ width: "100%", justifyContent: "center" }}>
            Open Dashboard <ExternalLink size={14} style={{ marginLeft: "8px" }} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      gap: "16px", 
      padding: "16px",
      fontFamily: "var(--font-ui)",
      color: "var(--text-primary)"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--emerald)", boxShadow: "0 0 8px var(--emerald)" }} />
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{issueKey} Traced</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {runs.length > 1 && (
            <select 
              value={run.run_id} 
              onChange={(e) => {
                const r = runs.find(x => x.run_id === e.target.value);
                if (r) void loadRunDetail(r);
              }}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
                fontSize: "11px",
              }}
            >
              {runs.map(r => (
                <option key={r.run_id} value={r.run_id}>
                  {r.started_at?.slice(5, 16).replace("T", " ")}
                </option>
              ))}
            </select>
          )}
          <Badge color={run.status === "completed" ? "green" : run.status === "failed" ? "rose" : "blue"}>
            {run.status}
          </Badge>
        </div>
      </div>

      {/* Loading state for RunDetail switch */}
      {!detail && (
        <div style={{ padding: "20px", display: "flex", justifyContent: "center" }}>
          <div style={{ animation: "pulse 1.5s infinite", fontSize: "12px", color: "var(--text-muted)" }}>Loading trace details...</div>
        </div>
      )}

      {detail && (
        <>
          {/* Metrics Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div style={{ background: "var(--bg-surface)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
            <Database size={13} />
            Steps Recorded
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>{detail.step_count}</div>
        </div>
        <div style={{ background: "var(--bg-surface)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
            <Zap size={13} />
            Agent ID
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
            {run.agent_id.split("-")[0]}
          </div>
        </div>
      </div>

      {/* Drift Warning Banner */}
      {detail.steps.some(s => (s.payload as any)?.status === "drift_warning") && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", background: "var(--amber-dim)", border: "1px solid rgba(245,158,11,0.3)", padding: "12px", borderRadius: "var(--radius-md)" }}>
          <AlertTriangle size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--amber-text)" }}>Schema Drift Detected</span>
            <span style={{ fontSize: "12px", color: "var(--amber-text)", opacity: 0.9 }}>This run encountered a contract violation with the underlying Jira API.</span>
          </div>
        </div>
      )}
      {/* Timeline Inspector Accordion */}
      <div id="execution-timeline">
      <Card>
        <CardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Database size={15} style={{ color: "var(--orange)" }} />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Execution Timeline</span>
          </div>
          {patchedSteps.length > 0 && (
            <div style={{ display: "flex", background: "var(--bg-raised)", borderRadius: "var(--radius-md)", padding: "2px" }}>
              <button
                onClick={() => setTimelineMode("original")}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: timelineMode === "original" ? "var(--bg-surface)" : "transparent",
                  color: timelineMode === "original" ? "var(--purple-text)" : "var(--text-muted)",
                  boxShadow: timelineMode === "original" ? "var(--shadow-sm)" : "none",
                  cursor: "pointer",
                }}
              >
                Original
              </button>
              <button
                onClick={() => setTimelineMode("simulated")}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: timelineMode === "simulated" ? "var(--bg-surface)" : "transparent",
                  color: timelineMode === "simulated" ? "var(--purple-text)" : "var(--text-muted)",
                  boxShadow: timelineMode === "simulated" ? "var(--shadow-sm)" : "none",
                  cursor: "pointer",
                }}
              >
                Simulated
              </button>
            </div>
          )}
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--border)", maxHeight: "400px", overflowY: "auto" }}>
            {(timelineMode === "simulated" && patchedSteps.length > 0 ? (patchedSteps as Step[]) : detail.steps).map((step, index, arr) => {
              const isSelected = selectedStepId === step.step_id;
              return (
                <div key={step.step_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <button
                    onClick={() => setSelectedStepId(isSelected ? null : step.step_id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      padding: "12px",
                      background: isSelected ? "var(--bg-surface)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      gap: "12px",
                      transition: "background var(--transition)"
                    }}
                  >
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--bg-raised)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>
                      {step.step_index}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stepName(step)}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stepSubtitle(step)}</span>
                    </div>
                    {isSelected ? <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                  </button>
                  
                  {isSelected && (
                    <div style={{ padding: "0 12px 12px 12px", background: "var(--bg-surface)" }}>
                      <StepInspector step={step} previousStep={index > 0 ? arr[index - 1] : undefined} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
      </div>

      {/* Workflow Graph Toggle */}
      <Card>
        <CardHeader style={{ cursor: "pointer", paddingBottom: showGraph ? "12px" : "16px" }} onClick={() => setShowGraph(!showGraph)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={15} style={{ color: "var(--blue)" }} />
              <span style={{ fontSize: "14px", fontWeight: 600 }}>Workflow Visualizer</span>
            </div>
            {showGraph ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
          </div>
        </CardHeader>
        {showGraph && (
          <div style={{ height: "350px", borderTop: "1px solid var(--border)", position: "relative" }}>
            <WorkflowGraph 
              originalSteps={detail.steps} 
              patchedSteps={patchedSteps} 
              patchStep={patchStep} 
              height="100%" 
              compact={true}
              onNodeClick={(stepId) => {
                setSelectedStepId(stepId);
                document.getElementById('execution-timeline')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </Card>

      {/* Safe Replay */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <RotateCcw size={15} style={{ color: "var(--cyan)" }} />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Safe Replay</span>
          </div>
        </CardHeader>
        <CardBody style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Button 
            variant="primary" 
            icon={<Play size={14} />} 
            loading={busy === "strict"}
            onClick={() => void runSafeReplay()}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {busy === "strict" ? "Replaying..." : "Run Safe Replay"}
          </Button>
          {strictReplay && <StrictReplayCard replay={strictReplay} />}
        </CardBody>
      </Card>

      {/* Simulate Route */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Split size={15} style={{ color: "var(--violet)" }} />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Simulate Route Change</span>
          </div>
        </CardHeader>
        <CardBody style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {ROUTE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPatchBoard(opt.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${patchBoard === opt.value ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                  background: patchBoard === opt.value ? "var(--violet-dim)" : "var(--bg-raised)",
                  color: patchBoard === opt.value ? "var(--violet)" : "var(--text-secondary)",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            icon={<Brain size={14} />}
            loading={busy === "exploratory"}
            onClick={() => void runExploratory()}
            disabled={patchStep === null || !detail}
            style={{ width: "100%", justifyContent: "center", borderColor: "rgba(167,139,250,0.3)", color: "var(--violet)" }}
          >
            {busy === "exploratory" ? "Analyzing..." : "Simulate Alternate Route"}
          </Button>
          
          {exploratoryReplay && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <VerdictPanel replay={exploratoryReplay} />
              
              {!promotedId ? (
                <Button variant="success" icon={<BadgeCheck size={14} />} loading={busy === "promote"} onClick={() => void promote()} style={{ width: "100%", justifyContent: "center" }}>
                  Promote to Regression Test
                </Button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "8px", background: "var(--emerald-dim)", borderRadius: "var(--radius-md)", color: "var(--emerald)", fontSize: "12px", fontWeight: 600 }}>
                  <BadgeCheck size={14} /> Saved as regression test
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
      </>
      )}

      <Button variant="ghost" onClick={openFullApp} style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}>
        Open Full Dashboard <ExternalLink size={14} style={{ marginLeft: "8px" }} />
      </Button>

    </div>
  );
}
