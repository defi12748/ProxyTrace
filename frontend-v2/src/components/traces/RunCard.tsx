import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { compactId, formatDate } from "../../api/client";
import { Badge, statusColor } from "../ui/Badge";
import { StatusDot } from "../ui/StatusDot";
import type { Run } from "../../api/types";

interface RunCardProps {
  run: Run;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function RunCard({ run, active, compact, onClick }: RunCardProps) {
  const navigate = useNavigate();

  function handleClick() {
    if (onClick) { onClick(); return; }
    navigate(`/traces/${run.run_id}`);
  }

  return (
    <button
      id={`run-card-${run.run_id}`}
      onClick={handleClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        textAlign: "left",
        padding: compact ? "10px 12px" : "12px 14px",
        background: active ? "var(--bg-overlay)" : "var(--bg-raised)",
        border: `1px solid ${active ? "rgba(99,179,237,0.35)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        transition: "all var(--transition)",
        boxShadow: active ? "0 0 0 1px rgba(99,179,237,0.15), var(--shadow-sm)" : "none",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          e.currentTarget.style.background = "var(--bg-overlay)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.background = "var(--bg-raised)";
        }
      }}
    >
      {/* Active left bar */}
      {active && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "8px",
            bottom: "8px",
            width: "3px",
            borderRadius: "0 3px 3px 0",
            background: "var(--cyan)",
          }}
        />
      )}

      <StatusDot status={run.status} pulse />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "3px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {run.jira_issue_key ?? "No issue"}
          </span>
          <Badge color={statusColor(run.status)}>{run.status}</Badge>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {compactId(run.run_id)}
          </span>
          <span>·</span>
          <Clock size={10} />
          <span>{formatDate(run.started_at)}</span>
        </div>
      </div>

      {!compact && <ArrowRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
    </button>
  );
}
