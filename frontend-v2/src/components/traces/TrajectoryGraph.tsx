import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildGraph, stepName, stepSubtitle } from "../../lib/utils";
import type { JsonObject, Step } from "../../api/types";

interface TrajectoryGraphProps {
  steps: Step[];
  patchedSteps: JsonObject[];
  patchStep: number | null;
  selectedNodeId?: string | null;
  onSelectNode?: (selection: TrajectoryGraphSelection) => void;
}

export type TrajectoryGraphSelection = {
  nodeId: string;
  branch: "original" | "patched";
  step: Step | JsonObject;
};

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
  selectedNodeId,
  onSelectNode,
}: TrajectoryGraphProps) {
  const graph = useMemo(
    () => buildGraph(
      steps,
      patchedSteps,
      patchStep,
      (step, stepIndex, isUnverified) => (
        <NodeLabel step={step} stepIndex={stepIndex} isUnverified={isUnverified} />
      )
    ),
    [patchStep, patchedSteps, steps]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    const timer = window.setTimeout(() => {
      void flow?.fitView({ padding: 0.16, duration: 250 });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [flow, graph, setEdges, setNodes]);

  const activeNodes = nodes.map(node => ({
    ...node,
    selected: node.id === selectedNodeId,
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={setFlow}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.35}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        onNodeClick={(_, node) => {
          const step = node.data.step as Step | JsonObject | undefined;
          const branch = node.data.branch;
          if (onSelectNode && step && (branch === "original" || branch === "patched")) {
            onSelectNode({ nodeId: node.id, branch, step });
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
          showInteractive
          position="top-right"
          orientation="horizontal"
          aria-label="Trajectory graph controls"
          style={{
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            margin: "10px",
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
          cursor: grab;
        }
        .react-flow__node:active .pt-node {
          cursor: grabbing;
        }
        .pt-node:hover {
          border-color: rgba(99,179,237,0.4);
        }
      `}</style>
    </div>
  );
}
