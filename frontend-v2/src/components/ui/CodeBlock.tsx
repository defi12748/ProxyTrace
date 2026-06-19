import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  title?: string;
  value: unknown;
  collapsed?: boolean;
  maxHeight?: string;
}

export function CodeBlock({ title, value, collapsed = true, maxHeight = "240px" }: CodeBlockProps) {
  const [open, setOpen] = useState(!collapsed);
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value ?? {}, null, 2);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: open ? "1px solid var(--border)" : "none",
            cursor: "pointer",
          }}
          onClick={() => setOpen((o) => !o)}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                transition: "transform var(--transition)",
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ▶
            </span>
            {title}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void copy();
            }}
            title="Copy"
            style={{
              background: "transparent",
              border: "none",
              color: copied ? "var(--emerald)" : "var(--text-muted)",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              transition: "color var(--transition)",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}
      {(!title || open) && (
        <pre
          style={{
            margin: 0,
            padding: "12px",
            maxHeight,
            overflow: "auto",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text}
        </pre>
      )}
    </div>
  );
}
