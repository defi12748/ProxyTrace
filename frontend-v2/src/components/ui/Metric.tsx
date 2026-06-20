import type { ReactNode } from "react";

interface MetricProps {
  label: string;
  value: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  iconBg?: string;
  delta?: string;
  deltaColor?: string;
}

/* Matches dotrack StatCard pattern exactly */
export function Metric({ label, value, subtitle, icon, iconBg, delta, deltaColor }: MetricProps) {
  return (
    <div
      style={{
        padding: "16px",
        background: "var(--bg-base)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "8px",
      }}
    >
      {/* Top row: label + icon */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.4 }}>
            {label}
          </div>
          {subtitle && (
            <div style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.4 }}>
              {subtitle}
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-md)",
              background: iconBg ?? "var(--purple-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Main value */}
      <div style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-secondary)" }}>
        {value}
      </div>

      {/* Delta row */}
      {delta && (
        <div style={{ fontSize: "12px", color: deltaColor ?? "var(--text-muted)" }}>
          {delta}
        </div>
      )}
    </div>
  );
}
