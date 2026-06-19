import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Brain,
  RotateCcw,
  Split,
  Zap,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { Badge, statusColor } from "../components/ui/Badge";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StrictReplayCard } from "../components/replay/StrictReplayCard";
import { VerdictPanel } from "../components/replay/VerdictPanel";
import { showToast } from "../components/ui/Toast";
import { ProxyTraceApi, getInitialApiBase, compactId, formatDate } from "../api/client";
import { stepName, stepSubtitle, pickFirstToolStep, ROUTE_OPTIONS } from "../lib/utils";
import type {
  ExploratoryReplay,
  JsonObject,
  RunDetail,
  StrictReplay,
} from "../api/types";

export function ReplayStudioPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);

  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [strictReplay, setStrictReplay] = useState<StrictReplay | null>(null);
  const [exploratoryReplay, setExploratoryReplay] = useState<ExploratoryReplay | null>(null);
  const [patchBoard, setPatchBoard] = useState("PLATFORM");
  const [promotedId, setPromotedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const patchStep = useMemo(
    () => (detail ? pickFirstToolStep(detail.steps, "get_project_key") : null),
    [detail]
  );

  const patchedSteps = useMemo(() => {
    const steps = exploratoryReplay?.verdict.patched_steps;
    return Array.isArray(steps) ? (steps as JsonObject[]) : [];
  }, [exploratoryReplay]);

  const loadDetail = useCallback(async () => {
    if (!runId) return;
    setBusy("load");
    try {
      const d = await api.get<RunDetail>(`/runs/${runId}`);
      setDetail(d);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Load failed", "error");
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

  const run = detail?.run;

  return (
    <PageShell
      title="Replay Studio"
      subtitle={run ? `${run.jira_issue_key ?? compactId(run.run_id)} · ${formatDate(run.started_at)}` : "Loading…"}
      actions={
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate(`/traces/${runId}`)}>
            Back to Trace
          </Button>
          {run && <Badge color={statusColor(run.status)}>{run.status}</Badge>}
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "16px", alignItems: "start" }}>
        {/* Left column — controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Safe replay card */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <RotateCcw size={15} style={{ color: "var(--cyan)" }} />
                <span style={{ fontSize: "14px", fontWeight: 600 }}>Safe Replay</span>
              </div>
            </CardHeader>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                Re-run the recorded trace from stored data. Write calls are blocked — Jira is never touched twice.
              </p>
              <Button
                variant="primary"
                icon={<RotateCcw size={14} />}
                loading={busy === "strict"}
                onClick={() => void runStrict()}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {busy === "strict" ? "Replaying…" : "Run Safe Replay"}
              </Button>
              {strictReplay && <StrictReplayCard replay={strictReplay} />}
            </CardBody>
          </Card>

          {/* What-if card */}
          <Card>
            <CardHeader>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Split size={15} style={{ color: "var(--violet)" }} />
                <span style={{ fontSize: "14px", fontWeight: 600 }}>What-If Simulation</span>
              </div>
            </CardHeader>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                Patch the routing decision at step {patchStep ?? "?"} and simulate how the agent would have responded.
              </p>

              {/* Board picker */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "6px" }}>
                  Target route
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {ROUTE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      id={`studio-board-${opt.value.toLowerCase()}`}
                      onClick={() => setPatchBoard(opt.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${patchBoard === opt.value ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                        background: patchBoard === opt.value ? "var(--violet-dim)" : "var(--bg-raised)",
                        color: patchBoard === opt.value ? "var(--violet)" : "var(--text-secondary)",
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
              </div>

              <Button
                variant="ghost"
                icon={<Brain size={14} />}
                loading={busy === "exploratory"}
                onClick={() => void runExploratory()}
                disabled={patchStep === null || !detail}
                style={{ width: "100%", justifyContent: "center", borderColor: "rgba(167,139,250,0.3)", color: "var(--violet)" }}
              >
                {busy === "exploratory" ? "Analyzing…" : "Simulate Route Change"}
              </Button>
            </CardBody>
          </Card>

          {/* Promote to regression */}
          {exploratoryReplay && (
            <Card style={promotedId ? { borderColor: "rgba(52,211,153,0.3)", boxShadow: "0 0 16px rgba(52,211,153,0.08)" } : {}}>
              <CardHeader>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <BadgeCheck size={15} style={{ color: "var(--emerald)" }} />
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>Regression Test</span>
                </div>
              </CardHeader>
              <CardBody style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  Save this simulation as a frozen regression test. Future agent versions will be checked against it.
                </p>
                {promotedId ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", background: "var(--emerald-dim)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "var(--radius-md)" }}>
                    <BadgeCheck size={14} style={{ color: "var(--emerald)" }} />
                    <span style={{ fontSize: "12px", color: "var(--emerald)", fontWeight: 600 }}>Saved as regression test</span>
                  </div>
                ) : (
                  <Button
                    variant="success"
                    icon={<BadgeCheck size={14} />}
                    loading={busy === "promote"}
                    onClick={() => void promote()}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Save as Regression Test
                  </Button>
                )}
                <Button
                  variant="ghost"
                  icon={<Zap size={14} />}
                  onClick={() => navigate("/regression")}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  View Regression Suite →
                </Button>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right column — diff + verdict */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* AI Verdict */}
          {exploratoryReplay && (
            <Card>
              <CardHeader>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Brain size={15} style={{ color: "var(--violet)" }} />
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>AI Evaluation Verdict</span>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {exploratoryReplay.replay_id.slice(0, 12)}…
                </span>
              </CardHeader>
              <CardBody>
                <VerdictPanel replay={exploratoryReplay} />
              </CardBody>
            </Card>
          )}

          {/* Side-by-side diff */}
          {exploratoryReplay && detail && (
            <Card>
              <CardHeader>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>Step Comparison</span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--cyan)" }}>■ Original</span>
                  <span style={{ fontSize: "11px", color: "var(--violet)" }}>■ Patched</span>
                  <span style={{ fontSize: "11px", color: "var(--amber)" }}>■ Changed</span>
                </div>
              </CardHeader>
              <CardBody style={{ padding: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "200px" }}>
                  {/* Original */}
                  <div style={{ borderRight: "1px solid var(--border)", padding: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--cyan)", marginBottom: "8px" }}>
                      Original
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {detail.steps.map((step) => {
                        const isPatched = step.step_index === patchStep;
                        const isAffected = patchedSteps.some(
                          (p) => Number(p.step_index) === step.step_index && !isPatched
                        );
                        return (
                          <DiffRow
                            key={step.step_id}
                            index={step.step_index}
                            name={stepName(step)}
                            subtitle={stepSubtitle(step)}
                            type={step.step_type}
                            highlight={isPatched ? "patch" : isAffected ? "affected" : "none"}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Patched */}
                  <div style={{ padding: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--violet)", marginBottom: "8px" }}>
                      Patched → {patchBoard}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {patchedSteps.map((step) => {
                        const stepIndex = Number(step.step_index ?? 0);
                        const isPatched = stepIndex === patchStep;
                        const isUnverified = Boolean(step.unverified);
                        return (
                          <DiffRow
                            key={stepIndex}
                            index={stepIndex}
                            name={stepName(step)}
                            subtitle={stepSubtitle(step)}
                            type={String(step.step_type ?? "unknown")}
                            highlight={isPatched ? "patch" : isUnverified ? "unverified" : "none"}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Empty state */}
          {!exploratoryReplay && !strictReplay && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "300px",
                background: "var(--bg-surface)",
                border: "1px dashed var(--border)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <EmptyState
                icon={<Split size={22} />}
                title="Run a replay to see results"
                description="Use the controls on the left to run a safe replay or what-if simulation."
              />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function DiffRow({
  index,
  name,
  subtitle,
  type,
  highlight,
}: {
  index: number;
  name: string;
  subtitle: string;
  type: string;
  highlight: "patch" | "affected" | "unverified" | "none";
}) {
  const hlColor = {
    patch: "var(--amber)",
    affected: "var(--violet)",
    unverified: "var(--rose)",
    none: "transparent",
  }[highlight];

  const hlBg = {
    patch: "rgba(251,191,36,0.07)",
    affected: "rgba(167,139,250,0.07)",
    unverified: "rgba(248,113,113,0.07)",
    none: "transparent",
  }[highlight];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 8px",
        borderRadius: "var(--radius-sm)",
        background: hlBg,
        border: `1px solid ${highlight !== "none" ? hlColor + "44" : "transparent"}`,
        borderLeft: highlight !== "none" ? `3px solid ${hlColor}` : "3px solid transparent",
        transition: "background var(--transition)",
      }}
    >
      <span
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "4px",
          display: "grid",
          placeItems: "center",
          fontSize: "10px",
          fontWeight: 700,
          background: type === "llm" ? "var(--violet-dim)" : "var(--cyan-dim)",
          color: type === "llm" ? "var(--violet)" : "var(--cyan)",
          flexShrink: 0,
        }}
      >
        {index}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
