import type { ReactNode } from "react";

type Color = "purple" | "green" | "blue" | "amber" | "rose" | "indigo" | "gray";

interface BadgeProps {
  children: ReactNode;
  color?: Color;
  dot?: boolean;
}

const colorMap: Record<Color, { bg: string; text: string; border: string }> = {
  purple: { bg: "var(--purple-dim)",  text: "var(--purple-text)", border: "var(--purple)" },
  green:  { bg: "var(--green-dim)",   text: "var(--green-text)",  border: "#86efac" },
  blue:   { bg: "var(--blue-dim)",    text: "var(--blue-text)",   border: "#93c5fd" },
  amber:  { bg: "var(--amber-dim)",   text: "var(--amber-text)",  border: "#fcd34d" },
  rose:   { bg: "var(--rose-dim)",    text: "var(--rose-text)",   border: "#fca5a5" },
  indigo: { bg: "var(--indigo-dim)",  text: "var(--indigo-text)", border: "#a5b4fc" },
  gray:   { bg: "#f3f4f6",            text: "#374151",            border: "#d1d5db" },
};

export function Badge({ children, color = "gray", dot = false }: BadgeProps) {
  const { bg, text, border } = colorMap[color];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 10px",
        borderRadius: "var(--radius-full)",
        fontSize: "12px",
        fontWeight: 500,
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: text,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

/* Maps a step/run status string to a badge color — matching dotrack StatusBadge */
export function statusColor(status: string): Color {
  const s = (status ?? "").toLowerCase();
  if (s === "completed") return "green";
  if (s === "running" || s === "in_progress") return "blue";
  if (s === "planned") return "indigo";
  if (s === "delayed") return "amber";
  if (s === "cancelled" || s === "canceled" || s === "failed") return "rose";
  if (s === "llm") return "purple";
  if (s === "tool") return "blue";
  return "gray";
}
