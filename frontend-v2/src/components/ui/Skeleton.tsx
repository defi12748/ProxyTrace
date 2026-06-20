/* Animated skeleton placeholder — matches dotrack's shimmer loading style */

interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = "16px", radius = "6px", style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, var(--border) 25%, var(--bg-raised) 50%, var(--border) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Skeleton width="40%" height="12px" />
      <Skeleton width="60%" height="20px" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={`${70 + (i % 3) * 10}%`} height="12px" />
      ))}
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width="50%" height="10px" />
        <Skeleton width="36px" height="36px" radius="10px" />
      </div>
      <Skeleton width="40%" height="28px" />
      <Skeleton width="70%" height="10px" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 16px",
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <Skeleton width="8px" height="8px" radius="50%" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <Skeleton width="30%" height="12px" />
        <Skeleton width="50%" height="10px" />
      </div>
    </div>
  );
}
