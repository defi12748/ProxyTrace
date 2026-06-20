import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface StructuredJsonProps {
  data: unknown;
  initiallyExpanded?: boolean;
}

export function StructuredJson({ data, initiallyExpanded = true }: StructuredJsonProps) {
  if (data === null) return <span style={{ color: "var(--amber)" }}>null</span>;
  if (data === undefined) return <span style={{ color: "var(--text-muted)" }}>undefined</span>;
  if (typeof data === "boolean") return <span style={{ color: "var(--purple-text)" }}>{data ? "true" : "false"}</span>;
  if (typeof data === "number") return <span style={{ color: "var(--blue)" }}>{data}</span>;
  if (typeof data === "string") return <span style={{ color: "var(--green)" }}>"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: "var(--text-muted)" }}>[]</span>;
    return <JsonArray arr={data} initiallyExpanded={initiallyExpanded} />;
  }

  if (typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length === 0) return <span style={{ color: "var(--text-muted)" }}>{"{}"}</span>;
    return <JsonObject obj={data as Record<string, unknown>} initiallyExpanded={initiallyExpanded} />;
  }

  return <span>{String(data)}</span>;
}

function JsonArray({ arr, initiallyExpanded }: { arr: unknown[]; initiallyExpanded: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  
  if (!expanded) {
    return (
      <span
        style={{ cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
        onClick={() => setExpanded(true)}
      >
        <ChevronRight size={14} /> [ {arr.length} items ]
      </span>
    );
  }

  return (
    <div>
      <span
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
        onClick={() => setExpanded(false)}
      >
        <ChevronDown size={14} style={{ color: "var(--text-muted)" }} /> [
      </span>
      <div style={{ paddingLeft: "16px", borderLeft: "1px dashed var(--border)", marginLeft: "6px" }}>
        {arr.map((val, i) => (
          <div key={i} style={{ display: "flex", gap: "4px" }}>
            <StructuredJson data={val} initiallyExpanded={initiallyExpanded} />
            {i < arr.length - 1 && <span style={{ color: "var(--text-muted)" }}>,</span>}
          </div>
        ))}
      </div>
      <span style={{ marginLeft: "6px" }}>]</span>
    </div>
  );
}

function JsonObject({ obj, initiallyExpanded }: { obj: Record<string, unknown>; initiallyExpanded: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const keys = Object.keys(obj);

  if (!expanded) {
    return (
      <span
        style={{ cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
        onClick={() => setExpanded(true)}
      >
        <ChevronRight size={14} /> {"{"} {keys.length} keys {"}"}
      </span>
    );
  }

  return (
    <div>
      <span
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
        onClick={() => setExpanded(false)}
      >
        <ChevronDown size={14} style={{ color: "var(--text-muted)" }} /> {"{"}
      </span>
      <div style={{ paddingLeft: "16px", borderLeft: "1px dashed var(--border)", marginLeft: "6px" }}>
        {keys.map((key, i) => (
          <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: "6px", lineHeight: "1.5" }}>
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>"{key}":</span>
            <div>
              <StructuredJson data={obj[key]} initiallyExpanded={initiallyExpanded} />
              {i < keys.length - 1 && <span style={{ color: "var(--text-muted)" }}>,</span>}
            </div>
          </div>
        ))}
      </div>
      <span style={{ marginLeft: "6px" }}>{"}"}</span>
    </div>
  );
}
