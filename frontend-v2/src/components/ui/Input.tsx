import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, style, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "8px 12px",
          fontSize: "13px",
          color: "var(--text-primary)",
          fontFamily: "var(--font-ui)",
          width: "100%",
          outline: "none",
          transition: "border-color var(--transition), box-shadow var(--transition)",
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(99,179,237,0.45)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,179,237,0.1)";
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "none";
          rest.onBlur?.(e);
        }}
      />
    </div>
  );
}
