import { StatusDot } from "../ui/StatusDot";
import { Badge, statusColor } from "../ui/Badge";
import type { Run } from "../../api/types";
import { formatDate, compactId } from "../../api/client";

interface RunCardProps {
  run: Run;
  onClick?: () => void;
  active?: boolean;
}

export function RunCard({ run, onClick, active = false }: RunCardProps) {
  return (
    <div
      className="premium-row"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 16px",
        background: active ? "var(--bg-surface)" : "var(--bg-base)",
        border: active ? "1px solid var(--border-strong)" : "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        cursor: "pointer",
        boxShadow: active ? "var(--shadow-sm)" : "none",
      }}
    >
      <StatusDot status={run.status} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
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
            {run.jira_issue_key ?? compactId(run.run_id)}
          </span>
          <Badge color={statusColor(run.status)}>{run.status}</Badge>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "8px" }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>{compactId(run.run_id)}</span>
          <span>·</span>
          <span>🕐 {formatDate(run.started_at)}</span>
        </div>
      </div>

      {/* Arrow */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
