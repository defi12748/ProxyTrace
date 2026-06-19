import type { ReactNode } from "react";

type Color = "cyan" | "violet" | "emerald" | "amber" | "rose" | "muted";

interface BadgeProps {
  children: ReactNode;
  color?: Color;
  dot?: boolean;
}

const colorMap: Record<Color, { bg: string; text: string; border: string }> = {
  cyan:    { bg: "var(--cyan-dim)",    text: "var(--cyan)",    border: "rgba(99,179,237,0.3)" },
  violet:  { bg: "var(--violet-dim)",  text: "var(--violet)",  border: "rgba(167,139,250,0.3)" },
  emerald: { bg: "var(--emerald-dim)", text: "var(--emerald)", border: "rgba(52,211,153,0.3)" },
  amber:   { bg: "var(--amber-dim)",   text: "var(--amber)",   border: "rgba(251,191,36,0.3)" },
  rose:    { bg: "var(--rose-dim)",    text: "var(--rose)",    border: "rgba(248,113,113,0.3)" },
  muted:   { bg: "rgba(255,255,255,0.05)", text: "var(--text-muted)", border: "var(--border)" },
};

export function Badge({ children, color = "cyan", dot }: BadgeProps) {
  const c = colorMap[color];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "2px 8px",
        borderRadius: "var(--radius-full)",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.03em",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: c.text,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

/* Status → color mapping helper */
export function statusColor(status: string): Color {
  if (status === "completed") return "emerald";
  if (status === "running") return "cyan";
  if (status === "failed") return "rose";
  if (status === "tool") return "cyan";
  if (status === "llm") return "violet";
  return "muted";
}
