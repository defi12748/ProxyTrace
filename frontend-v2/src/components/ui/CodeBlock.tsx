import { useState } from "react";
import { Copy, ChevronDown, ChevronUp } from "lucide-react";
import type { JsonValue } from "../../api/types";

interface CodeBlockProps {
  value: JsonValue;
  collapsed?: boolean;
  maxHeight?: string;
}

export function CodeBlock({ value, collapsed = true, maxHeight = "200px" }: CodeBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [copied, setCopied] = useState(false);

  const text = JSON.stringify(value, null, 2);

  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        fontSize: "12px",
        fontFamily: "var(--font-mono)",
        background: "var(--bg-base)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "var(--bg-raised)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          JSON
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={copy}
            style={{
              display: "flex", alignItems: "center", gap: "4px",
              padding: "3px 8px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              fontSize: "10px", fontFamily: "var(--font-ui)",
              color: copied ? "var(--green-text)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <Copy size={10} />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              display: "flex", alignItems: "center",
              padding: "3px 6px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {isCollapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <pre
          style={{
            margin: 0, padding: "12px",
            maxHeight,
            overflowY: "auto",
            color: "var(--text-primary)",
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
