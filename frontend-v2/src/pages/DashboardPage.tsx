import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BadgeCheck, Database,
  Play, RefreshCw, ShieldCheck, Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { Metric } from "../components/ui/Metric";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { RunCard } from "../components/traces/RunCard";
import { EmptyState } from "../components/ui/EmptyState";
import { showToast } from "../components/ui/Toast";
import { SkeletonMetric, SkeletonRow } from "../components/ui/Skeleton";
import { SparkBar, DonutChart } from "../components/ui/Charts";
import { ProxyTraceApi, getInitialApiBase, formatDate } from "../api/client";
import type { Run, RegressionItem, Warning } from "../api/types";

/* Build last-7-days data from run list */
function buildSparkData(runs: Run[]) {
  const days: { label: string; value: number; hasDrift?: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    const dayStr = d.toISOString().slice(0, 10);
    const value = runs.filter((r) => (r.started_at ?? "").startsWith(dayStr)).length;
    days.push({ label, value });
  }
  return days;
}

export function DashboardPage() {
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);
  const navigate = useNavigate();

  const [runs, setRuns] = useState<Run[]>([]);
  const [regressions, setRegressions] = useState<RegressionItem[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [traceKey, setTraceKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const driftCount = warnings.filter((w) => w.warning_type.includes("drift")).length;
  const passCount = regressions.filter((r) => r.pass_count > 0 && r.fail_count === 0).length;
  const failCount = regressions.filter((r) => r.fail_count > 0).length;
  const runningCount = runs.filter((r) => r.status === "running").length;
  const completedCount = runs.filter((r) => r.status === "completed").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;
  const passRate = regressions.length > 0 ? Math.round((passCount / regressions.length) * 100) : null;

  const sparkData = useMemo(() => buildSparkData(runs), [runs]);
  const donutSegments = [
    { label: "Completed", value: completedCount, color: "var(--green)" },
    { label: "Running",   value: runningCount,   color: "var(--blue)" },
    { label: "Failed",    value: failedCount,    color: "var(--rose)" },
  ];

  const refresh = useCallback(async () => {
    setBusy("refresh");
    try {
      const [runRes, regRes] = await Promise.all([
        api.get<{ runs: Run[] }>("/runs?limit=50"),
        api.get<{ regressions: RegressionItem[] }>("/regression?limit=50"),
      ]);
      setRuns(runRes.runs);
      setRegressions(regRes.regressions);

      const warningResps = await Promise.all(
        runRes.runs.slice(0, 5).map((r) =>
          api.get<{ warnings: Warning[] }>(`/runs/${r.run_id}/warnings`)
            .catch(() => ({ warnings: [] as Warning[] }))
        )
      );
      setWarnings(warningResps.flatMap((r) => r.warnings));
    } catch {
      // API error handled
    } finally {
      setBusy(null);
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function traceIssue() {
    const key = traceKey.trim().toUpperCase();
    if (!key) { showToast("Enter a Jira issue key first.", "error"); return; }
    setBusy("trace");
    try {
      await api.post<{ run_id: string }>("/jira/trace", { issue_key: key });
      showToast(`Trace started for ${key}`, "success");
      setTraceKey("");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Trace failed", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageShell
      title="Dashboard"
      subtitle="Live overview of your AI agent observability system"
      actions={
        <Button
          variant="outline" size="sm"
          icon={<RefreshCw size={13} />}
          loading={busy === "refresh"}
          onClick={() => void refresh()}
        >
          Refresh
        </Button>
      }
    >
      {/* ── KPI Metrics ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonMetric key={i} />)
        ) : (
          <>
            <div className="animate-fade-in" style={{ "--stagger": "0ms" } as React.CSSProperties}>
              <Metric label="Total" subtitle="Runs" value={runs.length}
                icon={<Database size={18} style={{ color: "#172A54" }} />} iconBg="#BFD3FE"
                delta={`Last ${runs.length} recorded`} deltaColor="var(--blue-text)" />
            </div>
            <div className="animate-fade-in" style={{ "--stagger": "50ms" } as React.CSSProperties}>
              <Metric label="Drift" subtitle="Warnings" value={driftCount}
                icon={<AlertTriangle size={18} style={{ color: "#92400e" }} />} iconBg="var(--amber-dim)"
                delta={driftCount > 0 ? "Schema violations found" : "All contracts OK"}
                deltaColor={driftCount > 0 ? "var(--amber-text)" : "var(--green-text)"} />
            </div>
            <div className="animate-fade-in" style={{ "--stagger": "100ms" } as React.CSSProperties}>
              <Metric label="Regression" subtitle="Tests" value={regressions.length}
                icon={<BadgeCheck size={18} style={{ color: "var(--purple-text)" }} />} iconBg="var(--purple-dim)"
                delta={`${passCount} passing · ${failCount} failing`}
                deltaColor={failCount > 0 ? "var(--rose-text)" : "var(--green-text)"} />
            </div>
            <div className="animate-fade-in" style={{ "--stagger": "150ms" } as React.CSSProperties}>
              <Metric label="Pass" subtitle="Rate"
                value={passRate !== null ? `${passRate}%` : "—"} animate={false}
                icon={<ShieldCheck size={18} style={{ color: "var(--green-text)" }} />} iconBg="var(--green-dim)"
                delta={passRate !== null && passRate >= 80 ? "Above threshold" : "Needs attention"}
                deltaColor={passRate !== null && passRate >= 80 ? "var(--green-text)" : "var(--amber-text)"} />
            </div>
          </>
        )}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "16px" }}>
        {loading ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          <>
            {/* 7-day activity sparkline */}
            <div className="premium-card animate-fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", padding: "16px 20px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", "--stagger": "100ms" } as React.CSSProperties}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>Last 7 days</div>
                  <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>Run Activity</h2>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "var(--text-muted)", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--blue)", display: "inline-block" }} />Runs</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--amber)", display: "inline-block" }} />Drift</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", justifyContent: "space-between", paddingBottom: "4px", flex: 1 }}>
                <div style={{ flex: 1, minWidth: 0, height: "100%", minHeight: "100px" }}>
                  <SparkBar data={sparkData} height="100%" color="var(--blue)" driftColor="var(--amber)" />
                </div>
              </div>
            </div>

            {/* Status donut */}
            <div className="premium-card animate-fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", padding: "16px 20px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "12px", "--stagger": "150ms" } as React.CSSProperties}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>Breakdown</div>
                <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>Run Status</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <DonutChart segments={donutSegments} size={88} thickness={13} />
                  {/* Center label */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-secondary)" }}>{runs.length}</span>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>total</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {donutSegments.map((seg) => (
                    <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                      <span style={{ color: "var(--text-muted)" }}>{seg.label}</span>
                      <span style={{ fontWeight: 700, color: "var(--text-secondary)", marginLeft: "auto", paddingLeft: "12px" }}>{seg.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Main 2-col layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px" }}>

        {/* Recent runs */}
        <div className="premium-card animate-fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", "--stagger": "200ms" } as React.CSSProperties}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>Recent</span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>Trace Runs</h2>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Last {runs.length} runs</span>
          </div>
          <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "380px", overflowY: "auto" }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : runs.length === 0 ? (
              <EmptyState icon={<Database size={20} />} title="No traces yet" description="Trigger a Jira issue trace to get started." />
            ) : (
              runs.slice(0, 8).map((run) => (
                <RunCard key={run.run_id} run={run} onClick={() => navigate(`/traces/${run.run_id}`)} />
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Quick trace */}
          <div className="premium-card animate-fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", "--stagger": "250ms" } as React.CSSProperties}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--purple-dim)" }}>
              <span style={{ display: "block", fontSize: "11px", color: "var(--purple-text)", fontWeight: 600, marginBottom: "2px" }}>Quick Action</span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--purple-text)", margin: 0 }}>Trace Jira Issue</h2>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Input id="dashboard-issue-key" label="ISSUE KEY" value={traceKey}
                onChange={(e) => setTraceKey(e.target.value.toUpperCase())}
                placeholder="SCRUM-1" onKeyDown={(e) => { if (e.key === "Enter") void traceIssue(); }}
                style={{ textTransform: "uppercase" }} />
              <Button variant="primary" icon={<Play size={14} />}
                loading={busy === "trace"} onClick={() => void traceIssue()}
                style={{ width: "100%", justifyContent: "center", minHeight: "40px" }}>
                {busy === "trace" ? "Recording…" : "Start Trace"}
              </Button>
            </div>
          </div>

          {/* Drift summary */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>Alerts</span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>Recent Drift</h2>
            </div>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? (
                <div style={{ padding: "12px" }}><div style={{ height: "40px", background: "var(--border)", borderRadius: "var(--radius-md)" }} /></div>
              ) : warnings.filter((w) => w.warning_type.includes("drift")).slice(0, 4).map((w) => (
                <div key={w.warning_id} style={{ padding: "8px 12px", background: "var(--amber-dim)", border: "1px solid #fcd34d", borderRadius: "var(--radius-md)", borderLeft: "3px solid var(--amber)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--amber-text)", marginBottom: "2px" }}>{w.warning_type.replace(/_/g, " ")}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>step: {w.step_id?.slice(0, 8) ?? "—"} · {formatDate(w.surfaced_at)}</div>
                </div>
              ))}
              {!loading && driftCount === 0 && (
                <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "var(--green-text)" }}>✓ No drift detected</div>
              )}
            </div>
          </div>

          {/* Regression summary */}
          {regressions.length > 0 && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={16} style={{ color: "var(--purple-text)" }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {regressions.length} regression test{regressions.length !== 1 ? "s" : ""}
                </span>
              </div>
              {passRate !== null && (
                <span style={{ fontSize: "16px", fontWeight: 700, color: passRate >= 80 ? "var(--green-text)" : "var(--amber-text)" }}>
                  {passRate}% pass
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
