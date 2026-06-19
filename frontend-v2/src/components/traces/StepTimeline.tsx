import { AlertTriangle } from "lucide-react";
import { stepName, stepSubtitle } from "../../lib/utils";
import { Badge, statusColor } from "../ui/Badge";
import type { Step, Warning } from "../../api/types";

interface StepTimelineProps {
  steps: Step[];
  selectedStepId: string | null;
  warnings: Warning[];
  onSelect: (stepId: string) => void;
}

export function StepTimeline({
  steps,
  selectedStepId,
  warnings,
  onSelect,
}: StepTimelineProps) {
  const warnedStepIds = new Set(
    warnings
      .filter((w) => w.warning_type.includes("drift"))
      .map((w) => w.step_id)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "10px" }}>
      {steps.map((step) => {
        const active = step.step_id === selectedStepId;
        const hasDrift = warnedStepIds.has(step.step_id);
        const isLlm = step.step_type === "llm";

        return (
          <button
            key={step.step_id}
            id={`step-btn-${step.step_id}`}
            onClick={() => onSelect(step.step_id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              background: active ? "var(--bg-overlay)" : "transparent",
              border: `1px solid ${active ? "rgba(99,179,237,0.35)" : "transparent"}`,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all var(--transition)",
              width: "100%",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = "transparent";
            }}
          >
            {/* Step number bubble */}
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-sm)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                fontSize: "12px",
                fontWeight: 700,
                background: isLlm
                  ? "var(--violet-dim)"
                  : "var(--cyan-dim)",
                color: isLlm ? "var(--violet)" : "var(--cyan)",
                border: `1px solid ${isLlm ? "rgba(167,139,250,0.2)" : "rgba(99,179,237,0.2)"}`,
              }}
            >
              {step.step_index}
            </div>

            {/* Step info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginBottom: "2px",
                }}
              >
                {stepName(step)}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {stepSubtitle(step)}
              </div>
            </div>

            {/* Right badges */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              {hasDrift && (
                <span title="Drift warning" style={{ display: "flex", alignItems: "center" }}>
                  <AlertTriangle size={12} style={{ color: "var(--amber)" }} />
                </span>
              )}
              <Badge color={statusColor(step.step_type)}>
                {step.step_type}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
