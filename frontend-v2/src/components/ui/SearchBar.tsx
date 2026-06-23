import { useState, useRef } from "react";
import { Search, X } from "lucide-react";
import type { CSSProperties } from "react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
  style?: CSSProperties;
}

/* Animated expanding search bar — identical to dotrack SearchBar.js */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search…",
  compact = false,
  style,
}: SearchBarProps) {
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
        width: active
          ? compact ? "min(46vw, 170px)" : "220px"
          : compact ? "42px" : "130px",
        minWidth: active
          ? compact ? "min(46vw, 170px)" : "220px"
          : compact ? "42px" : "130px",
        transition: "all 0.3s ease",
        cursor: "pointer",
        overflow: "hidden",
        ...style,
      }}
    >
      <button
        type="button"
        aria-label={active && value.trim() && onSubmit ? "Run search" : "Open search"}
        onClick={(e) => {
          e.stopPropagation();
          if (active && value.trim() && onSubmit) {
            onSubmit(value.trim());
            inputRef.current?.blur();
          } else {
            activate();
          }
        }}
        style={{
          display: "grid",
          placeItems: "center",
          width: "18px",
          height: "24px",
          padding: 0,
          border: 0,
          background: "transparent",
          color: "var(--text-secondary)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Search size={15} />
      </button>

      {/* Static label fades out */}
      {!active && (
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {compact ? "" : "Search…"}
        </span>
      )}

      {/* Actual input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onSubmit?.(value.trim());
            inputRef.current?.blur();
          }
        }}
        onBlur={deactivate}
        aria-label={placeholder}
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
