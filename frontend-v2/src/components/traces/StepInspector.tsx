import { CodeBlock } from "../ui/CodeBlock";
import { Badge, statusColor } from "../ui/Badge";
import { stepStory, formatFactValue } from "../../lib/utils";
import type { Step } from "../../api/types";

interface StepInspectorProps {
  step: Step;
}

export function StepInspector({ step }: StepInspectorProps) {
  const story = stepStory(step);
  const isLlm = step.step_type === "llm";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        animation: "fadeIn 150ms ease forwards",
      }}
    >
      {/* Hero */}
      <div
        style={{
          padding: "16px",
          background: "var(--bg-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          borderLeft: `3px solid ${isLlm ? "var(--violet)" : "var(--cyan)"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: isLlm ? "var(--violet)" : "var(--cyan)",
            }}
          >
            Step {step.step_index} · {step.step_type}
          </span>
          <Badge color={statusColor(step.step_type)}>{step.step_type}</Badge>
        </div>
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 6px",
            lineHeight: 1.3,
          }}
        >
          {story.title}
        </h3>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {story.why}
        </p>
      </div>

      {/* Fact grid */}
      {story.facts.filter(([, v]) => v !== undefined && v !== null).length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "4px",
          }}
        >
          {story.facts
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  alignItems: "start",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "capitalize",
                  }}
                >
                  {key}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    fontFamily: typeof val === "string" && val.length > 40 ? "var(--font-mono)" : undefined,
                    overflowWrap: "anywhere",
                    lineHeight: 1.4,
                  }}
                >
                  {formatFactValue(val)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Raw JSON */}
      <CodeBlock title="Recorded payload" value={step.payload} collapsed />
      <CodeBlock title="State snapshot" value={step.snapshot} collapsed />
    </div>
  );
}
