import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CheckCircle2,
  PlayCircle,
  RefreshCw,
  TestTube2,
  XCircle,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StructuredJson } from "../components/ui/StructuredJson";
import { CountUp } from "../components/ui/CountUp";
import { SkeletonMetric, Skeleton } from "../components/ui/Skeleton";
import { showToast } from "../components/ui/Toast";
import { ProxyTraceApi, getInitialApiBase, formatDate, compactId } from "../api/client";
import type { RegressionItem, RegressionRunResult } from "../api/types";

export function RegressionPage() {
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);

  const [regressions, setRegressions] = useState<RegressionItem[]>([]);
  const [runResult, setRunResult] = useState<RegressionRunResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const res = await api.get<{ regressions: RegressionItem[] }>("/regression?limit=50");
      setRegressions(res.regressions);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Load failed", "error");
    } finally {
      setBusy(null);
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  async function runAll() {
    setBusy("run");
    try {
      const res = await api.post<RegressionRunResult>("/regression/run-all");
      setRunResult(res);
      showToast(`${res.passed}/${res.total} tests passed`, res.failed === 0 ? "success" : "error");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Run failed", "error");
    } finally {
      setBusy(null);
    }
  }
  
  async function runTest(testId: string) {
    setBusy(testId);
    try {
      const res = await api.post<RegressionRunResult>(`/regression/${testId}/run`);
      setRunResult(res);
      showToast(`${res.passed}/${res.total} tests passed`, res.failed === 0 ? "success" : "error");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Run failed", "error");
    } finally {
      setBusy(null);
    }
  }

  const totalPass = regressions.filter((r) => r.pass_count > 0 && r.fail_count === 0).length;
  const totalFail = regressions.filter((r) => r.fail_count > 0).length;
  const passRate = regressions.length > 0 ? Math.round((totalPass / regressions.length) * 100) : null;

  return (
    <PageShell
      title="Regression Suite"
      subtitle="Frozen assertion tests for your AI agent — the CI layer for determinism"
      actions={
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="ghost"
            icon={<RefreshCw size={14} />}
            loading={busy === "load"}
            onClick={() => void load()}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={<PlayCircle size={14} />}
            loading={busy === "run"}
            onClick={() => void runAll()}
            disabled={regressions.length === 0}
          >
            {busy === "run" ? "Running tests…" : "Run All Tests"}
          </Button>
        </div>
      }
    >
      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonMetric key={i} />)
        ) : (
          [
            { label: "Total Tests", value: regressions.length, color: "var(--text-primary)" },
            { label: "Passing", value: totalPass, color: "var(--green-text)" },
            { label: "Failing", value: totalFail, color: totalFail > 0 ? "var(--rose-text)" : "var(--text-muted)" },
            { label: "Pass Rate", value: passRate !== null ? `${passRate}%` : "—", color: passRate !== null && passRate >= 80 ? "var(--green-text)" : "var(--amber-text)" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 16px",
                boxShadow: "var(--shadow-sm)",
                transition: "box-shadow var(--transition)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
            >
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "6px" }}>
                {label}
              </div>
              <div style={{ fontSize: "26px", fontWeight: 700, color }}>
                {typeof value === "number" ? <CountUp to={value} /> : value}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Run result banner */}
      {runResult && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${runResult.failed === 0 ? "#86efac" : "#fca5a5"}`,
            background: runResult.failed === 0 ? "var(--green-dim)" : "var(--rose-dim)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            animation: "scaleIn 200ms ease forwards",
          }}
        >
          {runResult.failed === 0 ? (
            <CheckCircle2 size={20} style={{ color: "var(--green-text)", flexShrink: 0 }} />
          ) : (
            <XCircle size={20} style={{ color: "var(--rose-text)", flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: runResult.failed === 0 ? "var(--green-text)" : "var(--rose-text)" }}>
              {runResult.failed === 0 ? "All tests passed" : `${runResult.failed} test${runResult.failed !== 1 ? "s" : ""} failed`}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {runResult.passed}/{runResult.total} assertions satisfied
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ flex: 1, height: "6px", background: "var(--border)", borderRadius: "var(--radius-full)", overflow: "hidden", marginLeft: "auto" }}>
            <div
              style={{
                height: "100%",
                width: `${(runResult.passed / Math.max(runResult.total, 1)) * 100}%`,
                background: runResult.failed === 0 ? "var(--green-text)" : "var(--amber-text)",
                borderRadius: "var(--radius-full)",
                transition: "width 600ms ease",
              }}
            />
          </div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>
            {runResult.passed}/{runResult.total}
          </span>
        </div>
      )}

      {/* Regression table */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TestTube2 size={15} style={{ color: "var(--purple-text)" }} />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Test Pack</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {regressions.length} test{regressions.length !== 1 ? "s" : ""}
          </span>
        </CardHeader>

        {loading ? (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "130px 130px 130px 80px 80px 1fr 120px",
                gap: "8px",
                padding: "8px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--text-muted)",
              }}
            >
              <span>Test ID</span>
              <span>Run</span>
              <span>Replay</span>
              <span>Passed</span>
              <span>Failed</span>
              <span>Promoted</span>
              <span>Last Run</span>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: "11px 16px", borderBottom: "1px solid var(--border)" }}>
                <Skeleton width="100%" height="20px" radius="8px" />
              </div>
            ))}
          </div>
        ) : regressions.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<BadgeCheck size={22} />}
              title="No regression tests"
              description="Run a what-if simulation from a trace, then promote it as a regression test."
            />
          </CardBody>
        ) : (
          <div>
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "130px 130px 130px 80px 80px 1fr 120px 40px",
                gap: "8px",
                padding: "8px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--text-muted)",
              }}
            >
              <span>Test ID</span>
              <span>Run</span>
              <span>Replay</span>
              <span>Passed</span>
              <span>Failed</span>
              <span>Promoted</span>
              <span>Last Run</span>
              <span></span>
            </div>

            {regressions.map((reg) => {
              const expanded = expandedId === reg.test_id;
              const hasFailures = reg.fail_count > 0;
              return (
                <div key={reg.test_id}>
                  <button
                    id={`regression-row-${reg.test_id}`}
                    onClick={() => setExpandedId(expanded ? null : reg.test_id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "130px 130px 130px 80px 80px 1fr 120px 40px",
                      gap: "8px",
                      padding: "11px 16px",
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      background: expanded ? "var(--bg-raised)" : hasFailures ? "rgba(248, 113, 113, 0.05)" : "transparent",
                      cursor: "pointer",
                      transition: "background var(--transition)",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => {
                      if (!expanded) e.currentTarget.style.background = hasFailures ? "rgba(248, 113, 113, 0.1)" : "var(--bg-raised)";
                    }}
                    onMouseLeave={(e) => {
                      if (!expanded) e.currentTarget.style.background = hasFailures ? "rgba(248, 113, 113, 0.05)" : "transparent";
                    }}
                  >
                    <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {compactId(reg.test_id)}
                    </span>
                    <Link
                      to={`/traces/${reg.run_id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--purple-text)", textDecoration: "none" }}
                    >
                      {compactId(reg.run_id)}
                    </Link>
                    <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {reg.replay_id ? compactId(reg.replay_id) : "—"}
                    </span>

                    {/* Pass count */}
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ display: "grid", placeItems: "center", width: "16px", height: "16px", borderRadius: "50%", background: "var(--green)", color: "#000", fontSize: "10px", fontWeight: 900 }}>✓</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--green-text)" }}>
                        {reg.pass_count}
                      </span>
                    </span>

                    {/* Fail count */}
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {hasFailures ? (
                        <>
                          <span style={{ display: "grid", placeItems: "center", width: "16px", height: "16px", borderRadius: "50%", background: "var(--rose)", color: "#fff", fontSize: "10px", fontWeight: 900 }}>✕</span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--rose-text)" }}>
                            {reg.fail_count}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-muted)" }}>0</span>
                      )}
                    </span>

                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {formatDate(reg.promoted_at)}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {formatDate(reg.last_run_at)}
                    </span>
                    
                    {/* Play Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); void runTest(reg.test_id); }}
                      disabled={busy === reg.test_id}
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "6px",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        transition: "all var(--transition)",
                        opacity: busy === reg.test_id ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--green)";
                        e.currentTarget.style.borderColor = "var(--green)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-secondary)";
                        e.currentTarget.style.borderColor = "var(--border)";
                      }}
                    >
                      {busy === reg.test_id ? <RefreshCw size={14} className="spin" /> : <PlayCircle size={14} />}
                    </button>
                  </button>

                  {/* Expanded assertions */}
                  {expanded && (
                    <div
                      style={{
                        padding: "14px 16px",
                        background: "var(--bg-raised)",
                        borderBottom: "1px solid var(--border)",
                        animation: "fadeIn 150ms ease forwards",
                      }}
                    >
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "8px" }}>
                        Frozen Assertions
                      </div>
                      <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "12px", overflowX: "auto", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                        <StructuredJson data={reg.assertions} initiallyExpanded={true} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </PageShell>
  );
}
