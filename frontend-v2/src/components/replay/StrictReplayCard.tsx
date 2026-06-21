import { ShieldCheck, Percent, Zap, Lock } from "lucide-react";
import { Badge } from "../ui/Badge";
import { confidenceLabel } from "../../lib/utils";
import type { StrictReplay } from "../../api/types";

interface StrictReplayCardProps {
  replay: StrictReplay;
}

export function StrictReplayCard({ replay }: StrictReplayCardProps) {
  const v = replay.verdict;
  const rate =
    typeof v.determinism_rate === "number" ? v.determinism_rate : null;
  const rateLabel = rate !== null ? confidenceLabel(rate) : "—";
  const isClean = rate === 1;

  return (
    <div
      style={{
        background: "var(--bg-raised)",
        border: `1px solid ${isClean ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        boxShadow: isClean ? "0 0 16px rgba(52,211,153,0.08)" : "none",
        animation: "scaleIn 200ms ease forwards",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldCheck size={16} style={{ color: isClean ? "var(--green)" : "var(--text-muted)" }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            Safe Replay
          </span>
        </div>
        {v.safety_guarantee !== undefined && (
          <Badge color={v.safety_guarantee ? "green" : "rose"}>
            {v.safety_guarantee ? "Safe" : "Unsafe"}
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {[
          { icon: <Percent size={13} />, label: "Determinism", value: rateLabel, accent: isClean ? "var(--green-text)" : "var(--amber-text)" },
          { icon: <Zap size={13} />, label: "Live Calls", value: String(v.live_call_count ?? "—") },
          { icon: <Lock size={13} />, label: "Blocked", value: String(v.side_effect_block_count ?? "—") },
        ].map(({ icon, label, value, accent }) => (
          <div
            key={label}
            style={{
              flex: "1 1 80px",
              padding: "10px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-muted)" }}>
              {icon}
              <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
            </div>
            <span style={{ fontSize: "18px", fontWeight: 700, color: accent ?? "var(--text-primary)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Replay ID */}
      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        replay: {replay.replay_id}
      </div>
    </div>
  );
}
