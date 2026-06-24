import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  id?: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/* Matches dotrack StatCard: bg-[#f5f6f8] rounded-lg border border-[#b3b4c6] */
export function Card({ id, children, style, className = "" }: CardProps) {
  return (
    <div
      id={id}
      className={`premium-card ${className}`}
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
  onClick?: () => void;
}

export function CardHeader({ children, style, onClick }: CardHeaderProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
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
