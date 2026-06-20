import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Database,
  Play,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Metric } from "../components/ui/Metric";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { RunCard } from "../components/traces/RunCard";
import { EmptyState } from "../components/ui/EmptyState";
import { showToast } from "../components/ui/Toast";
import { ProxyTraceApi, getInitialApiBase, formatDate } from "../api/client";
import type { Run, RegressionItem, Warning } from "../api/types";
import { useNavigate } from "react-router-dom";

export function DashboardPage() {
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);
  const navigate = useNavigate();

  const [runs, setRuns] = useState<Run[]>([]);
  const [regressions, setRegressions] = useState<RegressionItem[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [traceKey, setTraceKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const driftCount = warnings.filter((w) => w.warning_type.includes("drift")).length;
  const passCount = regressions.filter((r) => r.pass_count > 0 && r.fail_count === 0).length;
  const passRate =
    regressions.length > 0
      ? Math.round((passCount / regressions.length) * 100)
      : null;

  const refresh = useCallback(async () => {
    setBusy("refresh");
    try {
      const [runRes, regRes, health] = await Promise.all([
        api.get<{ runs: Run[] }>("/runs?limit=10"),
        api.get<{ regressions: RegressionItem[] }>("/regression?limit=50"),
        api.get<{ status: string }>("/health").catch(() => null),
      ]);
      setRuns(runRes.runs);
      setRegressions(regRes.regressions);
      setBackendOk(health?.status === "ok");

      const warningResps = await Promise.all(
        runRes.runs.slice(0, 5).map((r) =>
          api
            .get<{ warnings: Warning[] }>(`/runs/${r.run_id}/warnings`)
            .catch(() => ({ warnings: [] as Warning[] }))
        )
      );
      setWarnings(warningResps.flatMap((r) => r.warnings));
    } catch {
      setBackendOk(false);
    } finally {
      setBusy(null);
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
          variant="outline"
          size="sm"
          icon={<RefreshCw size={13} />}
          loading={busy === "refresh"}
          onClick={() => void refresh()}
        >
          Refresh
        </Button>
      }
    >
      {/* KPI metrics — matches dotrack StatsBoxes grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "16px",
        }}
      >
        <Metric
          label="Total"
          subtitle="Runs"
          value={runs.length}
          icon={<Database size={18} style={{ color: "#172A54" }} />}
          iconBg="#BFD3FE"
          delta={`Last ${runs.length} recorded`}
          deltaColor="var(--blue-text)"
        />
        <Metric
          label="Drift"
          subtitle="Warnings"
          value={driftCount}
          icon={<AlertTriangle size={18} style={{ color: "#92400e" }} />}
          iconBg="var(--amber-dim)"
          delta={driftCount > 0 ? "Schema violations found" : "All contracts OK"}
          deltaColor={driftCount > 0 ? "var(--amber-text)" : "var(--green-text)"}
        />
        <Metric
          label="Regression"
          subtitle="Tests"
          value={regressions.length}
          icon={<BadgeCheck size={18} style={{ color: "var(--purple-text)" }} />}
          iconBg="var(--purple-dim)"
          delta={`${passCount} passing`}
          deltaColor="var(--green-text)"
        />
        <Metric
          label="Pass"
          subtitle="Rate"
          value={passRate !== null ? `${passRate}%` : "—"}
          icon={<ShieldCheck size={18} style={{ color: "var(--green-text)" }} />}
          iconBg="var(--green-dim)"
          delta={passRate !== null && passRate >= 80 ? "Above threshold" : "Needs attention"}
          deltaColor={passRate !== null && passRate >= 80 ? "var(--green-text)" : "var(--amber-text)"}
        />
        <Metric
          label="Backend"
          subtitle="Status"
          value={backendOk === null ? "…" : backendOk ? "Online" : "Offline"}
          icon={<Activity size={18} style={{ color: backendOk ? "var(--green-text)" : "var(--rose-text)" }} />}
          iconBg={backendOk ? "var(--green-dim)" : "var(--rose-dim)"}
          delta="Render cloud"
          deltaColor="var(--text-muted)"
        />
      </div>

      {/* Main content — 2 col layout matching dotrack dashboard grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px" }}>

        {/* Recent runs list */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>
                Recent
              </span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
                Trace Runs
              </h2>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Last {runs.length} runs
            </span>
          </div>
          <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "420px", overflowY: "auto" }}>
            {runs.length === 0 ? (
              <EmptyState
                icon={<Database size={20} />}
                title="No traces yet"
                description="Trigger a Jira issue trace to get started."
              />
            ) : (
              runs.map((run) => (
                <RunCard
                  key={run.run_id}
                  run={run}
                  onClick={() => navigate(`/traces/${run.run_id}`)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Quick trace card */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                background: "var(--purple-dim)",
              }}
            >
              <span style={{ display: "block", fontSize: "11px", color: "var(--purple-text)", fontWeight: 600, marginBottom: "2px" }}>
                Quick Action
              </span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--purple-text)", margin: 0 }}>
                Trace Jira Issue
              </h2>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Input
                label="ISSUE KEY"
                id="dashboard-issue-key"
                value={traceKey}
                onChange={(e) => setTraceKey(e.target.value.toUpperCase())}
                placeholder="SCRUM-1"
                onKeyDown={(e) => { if (e.key === "Enter") void traceIssue(); }}
                style={{ textTransform: "uppercase" }}
              />
              <Button
                variant="primary"
                icon={<Play size={14} />}
                loading={busy === "trace"}
                onClick={() => void traceIssue()}
                style={{ width: "100%", justifyContent: "center", minHeight: "40px" }}
              >
                {busy === "trace" ? "Recording…" : "Start Trace"}
              </Button>
            </div>
          </div>

          {/* Drift summary */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>Alerts</span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>Recent Drift</h2>
            </div>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {warnings.filter((w) => w.warning_type.includes("drift")).slice(0, 4).map((w) => (
                <div
                  key={w.warning_id}
                  style={{
                    padding: "8px 12px",
                    background: "var(--amber-dim)",
                    border: "1px solid #fcd34d",
                    borderRadius: "var(--radius-md)",
                    borderLeft: "3px solid var(--amber)",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--amber-text)", marginBottom: "2px" }}>
                    {w.warning_type.replace(/_/g, " ")}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    step: {w.step_id?.slice(0, 8) ?? "—"} · {formatDate(w.surfaced_at)}
                  </div>
                </div>
              ))}
              {driftCount === 0 && (
                <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "var(--green-text)" }}>
                  ✓ No drift detected
                </div>
              )}
            </div>
          </div>

          {/* Regression summary */}
          {regressions.length > 0 && (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={16} style={{ color: "var(--purple-text)" }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {regressions.length} regression test{regressions.length !== 1 ? "s" : ""}
                </span>
              </div>
              {passRate !== null && (
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: passRate >= 80 ? "var(--green-text)" : "var(--amber-text)",
                  }}
                >
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
