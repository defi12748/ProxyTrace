import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "40px 20px",
        color: "var(--text-muted)",
        textAlign: "center",
      }}
    >
      {icon && (
        <div style={{ color: "var(--border-strong)", opacity: 0.7 }}>{icon}</div>
      )}
      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "320px" }}>
          {description}
        </div>
      )}
    </div>
  );
}
