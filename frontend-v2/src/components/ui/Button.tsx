import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "primary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, rgba(99,179,237,0.2), rgba(99,179,237,0.1))",
    borderColor: "rgba(99,179,237,0.4)",
    color: "var(--cyan)",
  },
  ghost: {
    background: "transparent",
    borderColor: "var(--border)",
    color: "var(--text-secondary)",
  },
  danger: {
    background: "rgba(248,113,113,0.12)",
    borderColor: "rgba(248,113,113,0.35)",
    color: "var(--rose)",
  },
  success: {
    background: "rgba(52,211,153,0.12)",
    borderColor: "rgba(52,211,153,0.35)",
    color: "var(--emerald)",
  },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: "5px 10px", fontSize: "12px", minHeight: "28px", gap: "5px" },
  md: { padding: "7px 14px", fontSize: "13px", minHeight: "34px", gap: "6px" },
  lg: { padding: "10px 20px", fontSize: "14px", minHeight: "40px", gap: "8px" },
};

export function Button({
  variant = "ghost",
  size = "md",
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        borderRadius: "var(--radius-md)",
        border: "1px solid",
        cursor: "pointer",
        transition: "all var(--transition)",
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        opacity: disabled || loading ? 0.5 : 1,
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
    >
      {loading ? (
        <span
          style={{
            width: "13px",
            height: "13px",
            borderRadius: "50%",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            animation: "spin 0.7s linear infinite",
            flexShrink: 0,
          }}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
