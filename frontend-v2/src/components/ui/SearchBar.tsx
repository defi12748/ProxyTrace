import { useState, useRef } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/* Animated expanding search bar — identical to dotrack SearchBar.js */
export function SearchBar({ value, onChange, placeholder = "Search…" }: SearchBarProps) {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function activate() {
    setActive(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function deactivate() {
    if (!value.trim()) setActive(false);
  }

  return (
    <div
      id="tour-cmd-palette"
      onClick={activate}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        height: "36px",
        padding: "0 10px",
        borderRadius: "var(--radius-md)",
        background: active ? "var(--bg-surface)" : "transparent",
        border: active ? "1px solid var(--border)" : "1px solid transparent",
        boxShadow: active ? "var(--shadow-input)" : "none",
        width: active ? "220px" : "130px",
        transition: "all 0.3s ease",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <Search size={15} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />

      {/* Static label fades out */}
      {!active && (
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          Search…
        </span>
      )}

      {/* Actual input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={deactivate}
        style={{
          position: "absolute",
          left: "32px",
          right: value ? "28px" : "8px",
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: "12px",
          fontFamily: "var(--font-ui)",
          color: "var(--text-secondary)",
          opacity: active ? 1 : 0,
          pointerEvents: active ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange(""); }}
          style={{
            position: "absolute",
            right: "6px",
            display: "flex",
            alignItems: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "2px",
            borderRadius: "50%",
          }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
