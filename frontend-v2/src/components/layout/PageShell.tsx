import type { ReactNode } from "react";

interface PageShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>

      {/* Page header — identical to dotrack's page headers */}
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
            {actions}
          </div>
        )}
      </div>

      {/* Page content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {children}
      </div>
    </div>
  );
}
