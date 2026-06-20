interface StatusDotProps {
  status: string;
  pulse?: boolean;
}

function dotColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed") return "var(--green)";
  if (s === "running" || s === "in_progress") return "var(--blue)";
  if (s === "failed" || s === "cancelled") return "var(--rose)";
  return "var(--text-muted)";
}

export function StatusDot({ status, pulse = true }: StatusDotProps) {
  const color = dotColor(status);
  return (
    <span
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        flexShrink: 0,
        animation: pulse && status.toLowerCase() === "running"
          ? "pulseDot 1.5s ease-in-out infinite"
          : undefined,
      }}
    />
  );
}
