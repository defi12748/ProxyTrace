import type { ReactNode } from "react";
import { Brain, AlertOctagon, TrendingUp, User, Zap, GitBranch, MessageSquare } from "lucide-react";
import { Badge } from "../ui/Badge";
import { StructuredJson } from "../ui/StructuredJson";
import { asRecord } from "../../api/client";
import { confidenceLabel } from "../../lib/utils";
import type { ExploratoryReplay } from "../../api/types";

interface VerdictPanelProps {
  replay: ExploratoryReplay;
}

function riskColor(level: unknown): "rose" | "amber" | "green" | "gray" {
  if (level === "high") return "rose";
  if (level === "medium") return "amber";
  if (level === "low") return "green";
  return "gray";
}

export function VerdictPanel({ replay }: VerdictPanelProps) {
  const executionStatus = replay.verdict.execution_status;
  const executionError = asRecord(replay.verdict.execution_error);
  const evaluation = asRecord(replay.verdict.evaluation);
  const semanticJudgment = asRecord(evaluation.semantic_judgment);
  const riskLevel = evaluation.risk_level as string | undefined;
  const confidence =
    typeof evaluation.judge_confidence === "number"
      ? evaluation.judge_confidence
      : null;

  if (executionStatus === "failed") {
    return (
      <div
        style={{
          padding: "14px 16px",
          background: "var(--rose-dim)",
          border: "1px solid rgba(248,113,113,0.35)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
        }}
      >
        <AlertOctagon size={17} style={{ color: "var(--rose)", flexShrink: 0, marginTop: "2px" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--rose-text)" }}>
            Simulation could not complete
          </div>
          <div style={{ marginTop: "4px", fontSize: "12px", lineHeight: 1.5, color: "var(--text-secondary)", overflowWrap: "anywhere" }}>
            {String(executionError.message ?? evaluation.failure_reason ?? "The current workflow rejected the recorded data.")}
          </div>
          <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
            No AI verdict or regression assertion was generated from this failed branch.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        animation: "scaleIn 200ms ease forwards",
      }}
    >
      {/* Main verdict header */}
      <div
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Brain size={16} style={{ color: "var(--violet)" }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            AI Evaluation
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {riskLevel && (
            <Badge color={riskColor(riskLevel)}>
              {String(riskLevel)} risk
            </Badge>
          )}
          {evaluation.human_review_required && (
            <Badge color="amber">
              <User size={10} /> Review needed
            </Badge>
          )}
        </div>
      </div>

      {/* Human Readable Summary */}
      {semanticJudgment.reasoning && (
        <div
          style={{
            background: "var(--violet-dim)",
            border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <MessageSquare size={16} style={{ color: "var(--violet)", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--violet)", marginBottom: "4px" }}>
              Summary
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 500 }}>
              {String(semanticJudgment.reasoning)}
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {confidence !== null && (
          <StatBox
            icon={<TrendingUp size={13} />}
            label="Judge confidence"
            value={confidenceLabel(confidence)}
            color={confidence > 0.7 ? "var(--green-text)" : "var(--amber-text)"}
          />
        )}
        {evaluation.root_cause_step !== undefined && (
          <StatBox
            icon={<Zap size={13} />}
            label="Root cause step"
            value={`Step ${String(evaluation.root_cause_step)}`}
          />
        )}
        {evaluation.divergence_type && (
          <StatBox
            icon={<GitBranch size={13} />}
            label="Divergence type"
            value={String(evaluation.divergence_type)}
          />
        )}
          {evaluation.ai_load_bearing !== undefined && (
          <StatBox
            icon={<Brain size={13} />}
            label="AI load-bearing"
            value={evaluation.ai_load_bearing ? "yes" : "no"}
            color={evaluation.ai_load_bearing ? "var(--purple-text)" : "var(--text-muted)"}
          />
        )}
      </div>

      {/* Semantic judgment */}
      {Object.keys(semanticJudgment).length > 0 && (
        <div
          style={{
            background: "rgba(167,139,250,0.07)",
            border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: "var(--radius-lg)",
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <AlertOctagon size={13} style={{ color: "var(--purple-text)" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--purple-text)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Semantic Judgment
            </span>
          </div>
          {semanticJudgment.expected_final_state !== undefined && (
            <SemanticRow label="Expected final state">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                <StructuredJson data={semanticJudgment.expected_final_state} initiallyExpanded />
              </div>
            </SemanticRow>
          )}
          {semanticJudgment.expected_final_board !== undefined && (
            <SemanticRow label="Expected board">
              {semanticJudgment.expected_final_board === null
                ? "No board required"
                : String(semanticJudgment.expected_final_board)}
            </SemanticRow>
          )}
          {semanticJudgment.satisfies_expected_outcome !== undefined && (
            <SemanticRow label="Outcome">
              <Badge color={semanticJudgment.satisfies_expected_outcome ? "green" : "rose"}>
                {semanticJudgment.satisfies_expected_outcome ? "Satisfied" : "Not satisfied"}
              </Badge>
            </SemanticRow>
          )}
          {Array.isArray(semanticJudgment.evidence) && semanticJudgment.evidence.length > 0 && (
            <SemanticRow label="Evidence">
              <ul style={{ margin: 0, paddingLeft: "16px", display: "grid", gap: "5px" }}>
                {semanticJudgment.evidence.map((item, index) => (
                  <li key={`${index}-${String(item)}`} style={{ lineHeight: 1.45 }}>
                    {String(item)}
                  </li>
                ))}
              </ul>
            </SemanticRow>
          )}
        </div>
      )}
    </div>
  );
}

function SemanticRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px minmax(0, 1fr)",
        gap: "8px",
        padding: "7px 0",
        borderBottom: "1px solid rgba(167,139,250,0.1)",
        fontSize: "12px",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
      <div style={{ color: "var(--text-secondary)", overflowWrap: "anywhere", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--bg-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-muted)" }}>
        {icon}
        <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: "14px", fontWeight: 600, color: color ?? "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}
