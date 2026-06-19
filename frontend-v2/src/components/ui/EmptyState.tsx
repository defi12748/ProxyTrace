import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--text-muted)",
        border: "1px dashed rgba(255,255,255,0.07)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      {icon && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-raised)",
            color: "var(--text-muted)",
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
          {title}
        </span>
        {description && (
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {description}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
