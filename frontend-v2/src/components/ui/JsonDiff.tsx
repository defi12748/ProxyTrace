import React from "react";

interface JsonDiffProps {
  title: string;
  oldValue?: unknown;
  newValue: unknown;
}

// Helper to determine if a value is an object
const isObject = (val: unknown): val is Record<string, unknown> => {
  return typeof val === "object" && val !== null && !Array.isArray(val);
};

export function JsonDiff({ title, oldValue, newValue }: JsonDiffProps) {
  if (!newValue) return null;

  const renderDiffNode = (oldNode: unknown, newNode: unknown, keyPath: string = "root"): React.ReactNode => {
    // If it's a primitive or array, just do a simple equality check
    if (!isObject(newNode)) {
      const changed = JSON.stringify(oldNode) !== JSON.stringify(newNode);
      return (
        <span style={{ 
          background: changed ? "rgba(16, 185, 129, 0.15)" : "transparent",
          color: changed ? "var(--emerald)" : "inherit",
          padding: changed ? "0 4px" : "0",
          borderRadius: "2px",
          fontWeight: changed ? 600 : "normal"
        }}>
          {JSON.stringify(newNode)}
        </span>
      );
    }

    // If it's an object, render its keys recursively
    const oldObj = isObject(oldNode) ? oldNode : {};
    
    return (
      <div style={{ paddingLeft: keyPath === "root" ? 0 : "16px" }}>
        {keyPath !== "root" && <span>{"{"}</span>}
        <div style={{ paddingLeft: keyPath === "root" ? 0 : "16px" }}>
          {Object.entries(newNode).map(([k, v], idx, arr) => {
            const hasOldKey = k in oldObj;
            const isDifferent = !hasOldKey || JSON.stringify(oldObj[k]) !== JSON.stringify(v);
            
            return (
              <div key={k} style={{ 
                background: isDifferent ? "rgba(16, 185, 129, 0.05)" : "transparent",
                borderLeft: isDifferent ? "2px solid var(--emerald)" : "2px solid transparent",
                paddingLeft: "8px",
                marginLeft: "-10px"
              }}>
                <span style={{ color: "var(--purple-text)" }}>"{k}"</span>:{" "}
                {renderDiffNode(oldObj[k], v, `${keyPath}.${k}`)}
                {idx < arr.length - 1 && ","}
              </div>
            );
          })}
        </div>
        {keyPath !== "root" && <span>{"}"}</span>}
      </div>
    );
  };

  return (
    <div style={{ marginTop: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{title}</div>
        {oldValue ? <div style={{ fontSize: "10px", color: "var(--emerald)", fontWeight: 600 }}>Diff View Active</div> : null}
      </div>
      <pre style={{ margin: 0, padding: "12px", background: "var(--bg-base)", borderRadius: "var(--radius-sm)", fontSize: "11px", overflowX: "auto", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
        <>{renderDiffNode(oldValue, newValue)}</>
      </pre>
    </div>
  );
}
