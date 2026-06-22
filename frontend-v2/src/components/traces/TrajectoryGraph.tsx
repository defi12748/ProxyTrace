import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
} from "@xyflow/react";
import { buildGraph, stepName, stepSubtitle } from "../../lib/utils";
import type { JsonObject, Step } from "../../api/types";

interface TrajectoryGraphProps {
  steps: Step[];
  patchedSteps: JsonObject[];
  patchStep: number | null;
  selectedStepId?: string | null;
  onSelectNode?: (stepId: string) => void;
}

function NodeLabel({
  step,
  stepIndex,
  isUnverified,
}: {
  step: Step | JsonObject;
  stepIndex: number;
  isUnverified: boolean;
}) {
  const isLlm = step.step_type === "llm";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "2px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <span
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            background: isLlm ? "var(--violet-dim)" : "var(--cyan-dim)",
            color: isLlm ? "var(--violet)" : "var(--cyan)",
            display: "grid",
            placeItems: "center",
            fontSize: "10px",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {stepIndex}
        </span>
        <strong
          style={{
            fontSize: "11px",
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          {stepName(step)}
        </strong>
      </div>
      <span
        style={{
          fontSize: "10px",
          color: isUnverified ? "var(--rose)" : "var(--text-muted)",
          lineHeight: 1.3,
        }}
      >
        {isUnverified ? "⚠ unverified path" : stepSubtitle(step)}
      </span>
    </div>
  );
}

export function TrajectoryGraph({
  steps,
  patchedSteps,
  patchStep,
  selectedStepId,
  onSelectNode,
}: TrajectoryGraphProps) {
  const { nodes, edges } = buildGraph(
    steps,
    patchedSteps,
    patchStep,
    (step, stepIndex, isUnverified) => (
      <NodeLabel step={step} stepIndex={stepIndex} isUnverified={isUnverified} />
    )
  );

  const activeNodes = nodes.map(node => ({
    ...node,
    className: node.className + (node.data.stepId === selectedStepId ? " selected" : "")
  }));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "300px",
        position: "relative",
      }}
    >
      {/* Labels */}
      {patchedSteps.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            right: "10px",
            zIndex: 5,
            display: "flex",
            justifyContent: "space-between",
            pointerEvents: "none",
          }}
        >
          {[
            { label: "Original", color: "var(--cyan)" },
            { label: "Patched", color: "var(--violet)" },
          ].map(({ label, color }) => (
            <span
              key={label}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(13,17,23,0.85)",
                border: `1px solid ${color}44`,
                color,
                backdropFilter: "blur(4px)",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <ReactFlow
        nodes={activeNodes}
        edges={edges}
        fitView
        minZoom={0.35}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          if (onSelectNode && typeof node.data.stepId === "string") {
            onSelectNode(node.data.stepId);
          }
        }}
        style={{
          background: "var(--bg-raised)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <Background
          gap={20}
          size={1}
          color="rgba(255,255,255,0.03)"
        />
        <Controls
          showInteractive={false}
          style={{
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        />
        <MiniMap
          nodeColor={(node) =>
            node.className?.toString().includes("pt-patched") ? "#B882FE" : "#63B3ED"
          }
          maskColor="rgba(245, 246, 248, 0.65)"
          pannable
          zoomable
          style={{
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-surface)",
          }}
        />
      </ReactFlow>

      {/* Node CSS injected inline (ReactFlow class overrides) */}
      <style>{`
        .pt-node {
          width: 210px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          box-shadow: var(--shadow-sm);
          font-family: var(--font-ui);
        }
        .pt-node.pt-patch-point {
          border-color: rgba(251,191,36,0.5);
          box-shadow: 0 0 12px rgba(251,191,36,0.15);
        }
        .pt-node.pt-patched {
          border-color: rgba(167,139,250,0.3);
        }
        .pt-node.pt-unverified {
          border-color: rgba(248,113,113,0.4);
        }
        .react-flow__node.selected .pt-node,
        .pt-node.selected {
          border-color: rgba(99,179,237,0.8);
          box-shadow: 0 0 12px rgba(99,179,237,0.2);
          cursor: pointer;
        }
        .pt-node {
          cursor: pointer;
        }
        .pt-node:hover {
          border-color: rgba(99,179,237,0.4);
        }
      `}</style>
    </div>
  );
}
