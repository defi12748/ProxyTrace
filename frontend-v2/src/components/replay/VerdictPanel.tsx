import { Brain, AlertOctagon, TrendingUp, User, Zap, GitBranch } from "lucide-react";
import { Badge } from "../ui/Badge";
import { asRecord } from "../../api/client";
import { confidenceLabel } from "../../lib/utils";
import type { ExploratoryReplay } from "../../api/types";

interface VerdictPanelProps {
  replay: ExploratoryReplay;
}

function riskColor(level: unknown): "rose" | "amber" | "emerald" | "muted" {
  if (level === "high") return "rose";
  if (level === "medium") return "amber";
  if (level === "low") return "emerald";
  return "muted";
}

export function VerdictPanel({ replay }: VerdictPanelProps) {
  const evaluation = asRecord(replay.verdict.evaluation);
  const semanticJudgment = asRecord(evaluation.semantic_judgment);
  const deterministic = asRecord(evaluation.deterministic_verdict);
  const riskLevel = (evaluation.risk_level ?? deterministic.risk_level) as string;
  const confidence =
    typeof evaluation.judge_confidence === "number"
      ? evaluation.judge_confidence
      : null;

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
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "var(--radius-full)", fontSize: "11px", fontWeight: 600, background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(251,191,36,0.3)" }}>
              <User size={10} />
              Review needed
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {confidence !== null && (
          <StatBox
            icon={<TrendingUp size={13} />}
            label="Judge confidence"
            value={confidenceLabel(confidence)}
            color={confidence > 0.7 ? "var(--emerald)" : "var(--amber)"}
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
            color={evaluation.ai_load_bearing ? "var(--violet)" : "var(--text-muted)"}
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
            <AlertOctagon size={13} style={{ color: "var(--violet)" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--violet)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Semantic Judgment
            </span>
          </div>
          {Object.entries(semanticJudgment).map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr",
                gap: "6px",
                padding: "4px 0",
                borderBottom: "1px solid rgba(167,139,250,0.1)",
                fontSize: "12px",
              }}
            >
              <span style={{ color: "var(--text-muted)", fontWeight: 600, textTransform: "capitalize" }}>
                {k.replace(/_/g, " ")}
              </span>
              <span style={{ color: "var(--text-secondary)", overflowWrap: "anywhere" }}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
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
