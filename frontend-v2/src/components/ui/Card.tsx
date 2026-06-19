import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({ children, style, className, glow, onClick }: CardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        transition: "border-color var(--transition), box-shadow var(--transition)",
        cursor: onClick ? "pointer" : undefined,
        ...(glow && { boxShadow: "var(--shadow-cyan)" }),
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
        padding: "14px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)",
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
  scroll?: boolean;
}

export function CardBody({ children, style, scroll }: CardBodyProps) {
  return (
    <div
      style={{
        padding: "14px 18px",
        overflowY: scroll ? "auto" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
