import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { showToast } from "../components/ui/Toast";
import { ProxyTraceApi, getInitialApiBase, formatDate, compactId } from "../api/client";
import type { Warning } from "../api/types";

type RunRef = { run_id: string; jira_issue_key: string | null };
type DriftRow = Warning & { run?: RunRef };

export function DriftPage() {
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);

  const [rows, setRows] = useState<DriftRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const runRes = await api.get<{ runs: { run_id: string; jira_issue_key: string | null }[] }>("/runs?limit=50");

      const warningResps = await Promise.all(
        runRes.runs.map((r) =>
          api
            .get<{ warnings: Warning[] }>(`/runs/${r.run_id}/warnings`)
            .then((w) => ({
              run: r,
              warnings: w.warnings.filter((w) => w.warning_type.includes("drift")),
            }))
            .catch(() => ({ run: r, warnings: [] as Warning[] }))
        )
      );

      const allRows: DriftRow[] = warningResps.flatMap(({ run, warnings }) =>
        warnings.map((w) => ({ ...w, run }))
      );
      // Sort newest first
      allRows.sort((a, b) =>
        (b.surfaced_at ?? "").localeCompare(a.surfaced_at ?? "")
      );
      setRows(allRows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Load failed", "error");
    } finally {
      setBusy(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const driftKinds = {
    input: rows.filter((r) => r.warning_type.includes("input")).length,
    output: rows.filter((r) => r.warning_type.includes("output")).length,
    descriptor: rows.filter((r) => r.warning_type.includes("descriptor")).length,
  };

  function driftColor(type: string): "amber" | "rose" | "violet" {
    if (type.includes("output")) return "rose";
    if (type.includes("descriptor")) return "violet";
    return "amber";
  }

  return (
    <PageShell
      title="Drift & Contracts"
      subtitle="Tool contract violations detected across recorded runs"
      actions={
        <Button
          variant="ghost"
          icon={<RefreshCw size={14} />}
          loading={busy}
          onClick={() => void load()}
        >
          Refresh
        </Button>
      }
    >
      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
        {[
          { label: "Total Warnings", value: rows.length, color: "var(--text-primary)" },
          { label: "Input Schema Drift", value: driftKinds.input, color: "var(--amber)" },
          { label: "Output Schema Drift", value: driftKinds.output, color: "var(--rose)" },
          { label: "Descriptor Drift", value: driftKinds.descriptor, color: "var(--violet)" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "6px" }}>
              {label}
            </div>
            <div style={{ fontSize: "26px", fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldAlert size={15} style={{ color: "var(--amber)" }} />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Drift Warnings</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Click a row to expand details
          </span>
        </CardHeader>

        {rows.length === 0 && !busy ? (
          <CardBody>
            <EmptyState
              icon={<CheckCircle2 size={22} />}
              title="No drift detected"
              description="All tool contracts are matching their recorded schemas."
            />
          </CardBody>
        ) : (
          <div>
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px 140px 130px 1fr 1fr 130px",
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
              <span>Warning Type</span>
              <span>Run</span>
              <span>Step</span>
              <span>Old Hash</span>
              <span>New Hash</span>
              <span>Surfaced</span>
            </div>

            {rows.map((row) => {
              const expanded = expandedId === row.warning_id;
              const color = driftColor(row.warning_type);
              return (
                <div key={row.warning_id}>
                  <button
                    onClick={() =>
                      setExpandedId(expanded ? null : row.warning_id)
                    }
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 140px 130px 1fr 1fr 130px",
                      gap: "8px",
                      padding: "10px 16px",
                      width: "100%",
                      textAlign: "left",
                      borderBottom: "1px solid var(--border)",
                      background: expanded ? "var(--bg-overlay)" : "transparent",
                      cursor: "pointer",
                      transition: "background var(--transition)",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => {
                      if (!expanded) e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      if (!expanded) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Badge color={color}>{row.warning_type.replace(/_/g, " ")}</Badge>
                    <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--cyan)" }}>
                      <Link
                        to={`/traces/${row.run_id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "var(--cyan)", textDecoration: "none" }}
                      >
                        {compactId(row.run_id)}
                      </Link>
                    </span>
                    <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {row.step_id ? compactId(row.step_id) : "—"}
                    </span>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.old_hash ? row.old_hash.slice(0, 16) + "…" : "—"}
                    </span>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.new_hash ? row.new_hash.slice(0, 16) + "…" : "—"}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {formatDate(row.surfaced_at)}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {expanded && (
                    <div
                      style={{
                        padding: "14px 16px",
                        background: "var(--bg-overlay)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        animation: "fadeIn 150ms ease forwards",
                      }}
                    >
                      {[
                        ["Warning ID", row.warning_id],
                        ["Run ID", row.run_id],
                        ["Step ID", row.step_id ?? "—"],
                        ["Old hash", row.old_hash ?? "—"],
                        ["New hash", row.new_hash ?? "—"],
                        ["Details", row.details],
                        ["Jira issue", row.run?.jira_issue_key ?? "—"],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "130px 1fr",
                            gap: "10px",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{k}</span>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "var(--font-mono)",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {v}
                          </span>
                        </div>
                      ))}
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
