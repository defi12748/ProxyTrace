import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

/* Matches dotrack SearchBar input: white bg, inset shadow, #DEE0E7 border */
export function Input({ label, style, onFocus, onBlur, ...rest }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
      {label && (
        <label
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </label>
      )}
      <input
        {...rest}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--purple)";
          e.currentTarget.style.boxShadow = "0 0 0 2px rgba(184,130,254,0.15), var(--shadow-input)";
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "var(--shadow-input)";
          onBlur?.(e);
        }}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: "13px",
          fontFamily: "var(--font-ui)",
          color: "var(--text-secondary)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-input)",
          outline: "none",
          transition: "border-color var(--transition), box-shadow var(--transition)",
          ...style,
        }}
      />
    </div>
  );
}
