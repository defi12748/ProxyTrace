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

export function DashboardPage() {
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);

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

      // Gather warnings from recent runs
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
          variant="ghost"
          icon={<RefreshCw size={14} />}
          loading={busy === "refresh"}
          onClick={() => void refresh()}
        >
          Refresh
        </Button>
      }
    >
      {/* KPI metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <Metric
          label="Total Runs"
          value={runs.length}
          icon={<Database size={14} />}
          color="cyan"
        />
        <Metric
          label="Drift Warnings"
          value={driftCount}
          icon={<AlertTriangle size={14} />}
          color={driftCount > 0 ? "amber" : "emerald"}
        />
        <Metric
          label="Regression Tests"
          value={regressions.length}
          icon={<BadgeCheck size={14} />}
          color="violet"
        />
        <Metric
          label="Pass Rate"
          value={passRate !== null ? `${passRate}%` : "—"}
          icon={<ShieldCheck size={14} />}
          color={passRate !== null && passRate >= 80 ? "emerald" : "amber"}
        />
        <Metric
          label="Backend"
          value={backendOk === null ? "…" : backendOk ? "Online" : "Offline"}
          icon={<Activity size={14} />}
          color={backendOk ? "emerald" : "rose"}
        />
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px" }}>
        {/* Recent runs */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
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
              <span
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "2px",
                }}
              >
                Recent
              </span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
                Trace Runs
              </h2>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Last {runs.length} runs
            </span>
          </div>
          <div
            style={{
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              maxHeight: "420px",
              overflowY: "auto",
            }}
          >
            {runs.length === 0 ? (
              <EmptyState
                icon={<Database size={20} />}
                title="No traces yet"
                description="Trigger a Jira issue trace to get started."
              />
            ) : (
              runs.map((run) => <RunCard key={run.run_id} run={run} compact />)
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Quick trace */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                background: "linear-gradient(135deg, rgba(99,179,237,0.08), rgba(167,139,250,0.06))",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--cyan)",
                  marginBottom: "2px",
                }}
              >
                Quick Action
              </span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
                Trace Jira Issue
              </h2>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Input
                label="Issue key"
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
                style={{ width: "100%", justifyContent: "center" }}
              >
                {busy === "trace" ? "Recording…" : "Start Trace"}
              </Button>
            </div>
          </div>

          {/* Drift summary */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "2px",
                }}
              >
                Alerts
              </span>
              <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
                Recent Drift
              </h2>
            </div>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {warnings.filter((w) => w.warning_type.includes("drift")).slice(0, 4).map((w) => (
                <div
                  key={w.warning_id}
                  style={{
                    padding: "8px 10px",
                    background: "var(--bg-raised)",
                    border: "1px solid rgba(251,191,36,0.2)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: "3px solid var(--amber)",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--amber)", marginBottom: "2px" }}>
                    {w.warning_type.replace(/_/g, " ")}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    step: {w.step_id?.slice(0, 8) ?? "—"} · {formatDate(w.surfaced_at)}
                  </div>
                </div>
              ))}
              {driftCount === 0 && (
                <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                  ✓ No drift detected
                </div>
              )}
            </div>
          </div>

          {/* Regression quick summary */}
          {regressions.length > 0 && (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={16} style={{ color: "var(--violet)" }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {regressions.length} regression test{regressions.length !== 1 ? "s" : ""}
                </span>
              </div>
              {passRate !== null && (
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: passRate >= 80 ? "var(--emerald)" : "var(--amber)",
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
