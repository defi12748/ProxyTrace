/* ======================================================
   Drift Check Modal — calls POST /runs/{run_id}/drift/check-all
   Shows a full step-by-step findings table with results
   ====================================================== */
import { useState } from "react";
import { ShieldAlert, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import type { DriftCheckResult, DriftStepResult } from "../../api/types";

interface DriftCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  runId: string;
  onRun: () => Promise<DriftCheckResult>;
}

function FindingRow({ finding }: { finding: { kind: string; detail: string; old_hash: string | null; new_hash: string | null } }) {
  const kindColors: Record<string, string> = {
    schema_drift: "var(--amber-text)",
    payload_drift: "var(--rose-text)",
    missing_field: "var(--rose-text)",
    extra_field: "var(--blue-text)",
  };
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "var(--bg-raised)",
        borderRadius: "var(--radius-md)",
        borderLeft: "3px solid var(--amber)",
        marginTop: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <AlertTriangle size={13} style={{ color: "var(--amber-text)", flexShrink: 0, marginTop: "1px" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: kindColors[finding.kind] ?? "var(--text-muted)",
            }}
          >
            {finding.kind.replace(/_/g, " ")}
          </span>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {finding.detail}
          </p>
          {(finding.old_hash || finding.new_hash) && (
            <div style={{ marginTop: "4px", display: "flex", gap: "8px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {finding.old_hash && <span>old: {finding.old_hash.slice(0, 12)}…</span>}
              {finding.new_hash && <span>new: {finding.new_hash.slice(0, 12)}…</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepResultRow({ result }: { result: DriftStepResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${result.drifted ? "rgba(245,158,11,0.3)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        background: result.drifted ? "rgba(245,158,11,0.03)" : "var(--bg-base)",
      }}
    >
      <button
        onClick={() => result.drifted && setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: result.drifted ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textAlign: "left",
        }}
      >
        {/* Expand icon */}
        <span style={{ color: "var(--text-muted)", flexShrink: 0, visibility: result.drifted ? "visible" : "hidden" }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        {/* Status icon */}
        {result.drifted ? (
          <AlertTriangle size={15} style={{ color: "var(--amber-text)", flexShrink: 0 }} />
        ) : (
          <CheckCircle size={15} style={{ color: "var(--green-text)", flexShrink: 0 }} />
        )}

        {/* Step info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            Step {result.step_index}
          </span>
          <span
            style={{
              marginLeft: "8px",
              fontSize: "12px",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {result.tool_name}
          </span>
        </div>

        {/* Finding badge */}
        {result.drifted && (
          <span style={{ flexShrink: 0 }}>
            <Badge color="amber">
              {result.finding_count} finding{result.finding_count !== 1 ? "s" : ""}
            </Badge>
          </span>
        )}
        {!result.drifted && (
          <span style={{ flexShrink: 0 }}>
            <Badge color="green">Clean</Badge>
          </span>
        )}
      </button>

      {expanded && result.findings.length > 0 && (
        <div style={{ padding: "0 14px 12px" }}>
          {result.findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DriftCheckModal({ isOpen, onClose, runId, onRun }: DriftCheckModalProps) {
  const [result, setResult] = useState<DriftCheckResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const r = await onRun();
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drift check failed");
    } finally {
      setRunning(false);
    }
  }

  function handleClose() {
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Re-evaluate Drift"
      subtitle={`Run ID: ${runId.slice(0, 8)}…`}
      icon={<ShieldAlert size={16} />}
      width="640px"
    >
      {/* Intro & trigger */}
      {!result && !running && (
        <div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 20px" }}>
            This will re-evaluate every <strong>tool step</strong> in this run against the current API contracts.
            Any new drift findings will be persisted to the database so they appear on the Drift page.
          </p>

          <div
            style={{
              padding: "14px 16px",
              background: "var(--amber-dim)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(245,158,11,0.2)",
              marginBottom: "20px",
              display: "flex",
              gap: "10px",
            }}
          >
            <AlertTriangle size={16} style={{ color: "var(--amber-text)", flexShrink: 0, marginTop: "1px" }} />
            <p style={{ margin: 0, fontSize: "12px", color: "var(--amber-text)", lineHeight: 1.5 }}>
              This operation may surface duplicate warnings if the run has been checked before. Results are appended, not replaced.
            </p>
          </div>

          {error && (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--rose-dim)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(239,68,68,0.2)",
                marginBottom: "16px",
                fontSize: "13px",
                color: "var(--rose-text)",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              variant="primary"
              icon={<ShieldAlert size={14} />}
              onClick={() => void handleRun()}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Run Drift Check
            </Button>
            <Button variant="ghost" onClick={handleClose} style={{ justifyContent: "center" }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {running && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "32px 0" }}>
          <Loader2 size={32} style={{ color: "var(--purple)", animation: "spin 1s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              Checking tool steps…
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
              Evaluating each tool call against recorded API contracts
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Summary banner */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-lg)",
              border: `1px solid ${result.all_clear ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
              background: result.all_clear ? "var(--green-dim)" : "var(--amber-dim)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            {result.all_clear ? (
              <CheckCircle size={20} style={{ color: "var(--green-text)", flexShrink: 0 }} />
            ) : (
              <ShieldAlert size={20} style={{ color: "var(--amber-text)", flexShrink: 0 }} />
            )}
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 700,
                  color: result.all_clear ? "var(--green-text)" : "var(--amber-text)",
                }}
              >
                {result.all_clear ? "All Clear — No drift detected" : `${result.steps_drifted} step${result.steps_drifted !== 1 ? "s" : ""} drifted`}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                {result.steps_checked} tool step{result.steps_checked !== 1 ? "s" : ""} checked
              </p>
            </div>

            {/* Re-run button */}
            <button
              onClick={() => void handleRun()}
              style={{
                marginLeft: "auto",
                padding: "5px 10px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all var(--transition)",
              }}
            >
              Re-run
            </button>
          </div>

          {/* Step-by-step results */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {result.results.map((r) => (
              <StepResultRow key={r.step_id} result={r} />
            ))}
            {result.results.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "20px 0" }}>
                No tool steps found to check.
              </p>
            )}
          </div>

          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
            <Button variant="ghost" onClick={handleClose} style={{ width: "100%", justifyContent: "center" }}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
