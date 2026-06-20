import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "primary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const variantStyle: Record<Variant, CSSProperties> = {
  /* matches dotrack CustomButton primary */
  primary: {
    background: "var(--purple)",
    color: "var(--purple-text)",
    border: "1px solid transparent",
  },
  /* matches dotrack ghost nav button */
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid transparent",
  },
  /* matches dotrack outline button in header */
  outline: {
    background: "var(--bg-base)",
    color: "var(--text-secondary)",
    border: "1px solid var(--text-secondary)",
  },
  danger: {
    background: "var(--rose-dim)",
    color: "var(--rose-text)",
    border: "1px solid #fca5a5",
  },
  success: {
    background: "var(--green-dim)",
    color: "var(--green-text)",
    border: "1px solid #86efac",
  },
};

const variantHover: Record<Variant, CSSProperties> = {
  primary: { background: "var(--purple-hover)" },
  ghost:   { background: "rgba(255,255,255,0.6)", borderColor: "var(--border-strong)" },
  outline: { color: "var(--text-primary)", borderColor: "var(--text-primary)" },
  danger:  { background: "#fecaca" },
  success: { background: "#bbf7d0" },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: "5px 10px",  fontSize: "12px", minHeight: "28px", gap: "5px" },
  md: { padding: "7px 14px",  fontSize: "13px", minHeight: "34px", gap: "6px" },
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
  onMouseEnter,
  onMouseLeave,
  className = "",
  ...rest
}: ButtonProps) {
  const base = variantStyle[variant];
  const hover = variantHover[variant];

  return (
    <button
      className={`premium-button ${className}`}
      {...rest}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, hover);
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, base);
        onMouseLeave?.(e);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-ui)",
        fontWeight: 600,
        borderRadius: "var(--radius-md)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        transition: "all var(--transition)",
        whiteSpace: "nowrap",
        letterSpacing: "0em",
        opacity: disabled || loading ? 0.5 : 1,
        ...base,
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
