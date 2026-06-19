interface StatusDotProps {
  status: string;
  pulse?: boolean;
}

const dotColor: Record<string, string> = {
  completed: "var(--emerald)",
  running:   "var(--cyan)",
  failed:    "var(--rose)",
  pending:   "var(--amber)",
};

export function StatusDot({ status, pulse }: StatusDotProps) {
  const color = dotColor[status] ?? "var(--text-muted)";
  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        ...(pulse && status === "running"
          ? {
              boxShadow: `0 0 0 0 ${color}`,
              animation: "pulseDot 1.5s ease-in-out infinite",
              color,
            }
          : {}),
      }}
    />
  );
}
