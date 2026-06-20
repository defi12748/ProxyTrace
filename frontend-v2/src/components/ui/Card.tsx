import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/* Matches dotrack StatCard: bg-[#f5f6f8] rounded-lg border border-[#b3b4c6] */
export function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function CardBody({ children, style }: CardBodyProps) {
  return (
    <div style={{ padding: "16px", ...style }}>
      {children}
    </div>
  );
}
