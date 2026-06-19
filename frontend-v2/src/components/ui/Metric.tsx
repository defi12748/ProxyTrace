import type { ReactNode, CSSProperties } from "react";

interface MetricProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: "cyan" | "violet" | "emerald" | "amber" | "rose";
  style?: CSSProperties;
}

const colorAccent: Record<string, string> = {
  cyan:    "var(--cyan)",
  violet:  "var(--violet)",
  emerald: "var(--emerald)",
  amber:   "var(--amber)",
  rose:    "var(--rose)",
};

const colorDim: Record<string, string> = {
  cyan:    "var(--cyan-dim)",
  violet:  "var(--violet-dim)",
  emerald: "var(--emerald-dim)",
  amber:   "var(--amber-dim)",
  rose:    "var(--rose-dim)",
};

export function Metric({ label, value, icon, color = "cyan", style }: MetricProps) {
  const accent = colorAccent[color];
  const dim = colorDim[color];

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        position: "relative",
        overflow: "hidden",
        transition: "border-color var(--transition)",
        ...style,
      }}
    >
      {/* top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-sm)",
              background: dim,
              color: accent,
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <span
        style={{
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}
