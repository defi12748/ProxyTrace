import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyIdProps {
  value: string;
  display?: string;
}

/** Truncated ID with clipboard copy button on hover */
export function CopyId({ value, display }: CopyIdProps) {
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const label = display ?? (value.length > 12 ? `${value.slice(0, 8)}…` : value);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        cursor: "default",
      }}
      className="copy-id-group"
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <button
        onClick={copy}
        title={copied ? "Copied!" : `Copy: ${value}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2px",
          borderRadius: "4px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: copied ? "var(--green-text)" : "var(--text-muted)",
          opacity: copied ? 1 : 0.6,
          transition: "opacity 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { if (!copied) e.currentTarget.style.opacity = "0.6"; }}
      >
        {copied ? <Check size={10} /> : <Copy size={10} />}
      </button>
    </span>
  );
}
