import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { stepName, stepSubtitle } from "../../lib/utils";
import type { JsonObject, Step } from "../../api/types";

interface WorkflowGraphProps {
  originalSteps: Step[];
  patchedSteps?: JsonObject[];
  patchStep?: number | null;
  height?: string;
  compact?: boolean;
  selectedNodeId?: string | null;
  onNodeClick?: (selection: WorkflowGraphSelection) => void;
}

export type WorkflowGraphSelection = {
  nodeId: string;
  branch: "original" | "patched";
  step: Step | JsonObject;
};

export function WorkflowGraph({
  originalSteps,
  patchedSteps = [],
  patchStep = null,
  height = "600px",
  compact = false,
  selectedNodeId = null,
  onNodeClick,
}: WorkflowGraphProps) {
  const graph = useMemo(() => {
    const nds: Node[] = [];
    const eds: Edge[] = [];
    const hasPatch = patchedSteps.length > 0;

    // Node style config (matching the new UI aesthetic)
    const nodeStyle = {
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      padding: "10px 14px",
      fontSize: "12px",
      color: "var(--text-secondary)",
      boxShadow: "var(--shadow-sm)",
      minWidth: "220px",
      fontFamily: "var(--font-ui)",
    };

    const patchPointStyle = {
      ...nodeStyle,
      borderColor: "var(--purple)",
      boxShadow: "0 0 0 2px var(--purple-dim)",
    };

    const simulatedStyle = {
      ...nodeStyle,
      background: "var(--purple-dim)",
      borderColor: "var(--purple)",
      color: "var(--purple-text)",
    };

    const unverifiedStyle = {
      ...nodeStyle,
      background: "var(--bg-raised)",
      borderColor: "var(--text-muted)",
      borderStyle: "dashed",
    };

    // Label Renderer
    const renderLabel = (
      stepIndex: number,
      name: string,
      subtitle: string,
      isSimulated: boolean
    ) => (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              background: isSimulated ? "rgba(255,255,255,0.5)" : "var(--bg-raised)",
              padding: "2px 6px",
              borderRadius: "4px",
              color: isSimulated ? "var(--purple-text)" : "var(--text-muted)",
            }}
          >
            STEP {stepIndex}
          </span>
          <strong
            style={{
              fontSize: "13px",
              color: isSimulated ? "var(--purple-dark)" : "var(--text-primary)",
            }}
          >
            {name}
          </strong>
        </div>
        <span
          style={{
            fontSize: "11px",
            color: isSimulated ? "var(--purple-text)" : "var(--text-muted)",
            opacity: 0.8,
            fontFamily: "var(--font-mono)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </span>
      </div>
    );

    // 1. Original branch
    originalSteps.forEach((step, index) => {
      const isPatchPoint = step.step_index === patchStep;
      nds.push({
        id: `o-${step.step_index}`,
        position: { x: 40, y: index * 100 },
        data: {
          stepId: step.step_id,
          step,
          branch: "original",
          label: renderLabel(step.step_index, stepName(step), stepSubtitle(step), false),
        },
        style: isPatchPoint ? patchPointStyle : nodeStyle,
      });

      if (index > 0) {
        eds.push({
          id: `oe-${originalSteps[index - 1].step_index}-${step.step_index}`,
          source: `o-${originalSteps[index - 1].step_index}`,
          target: `o-${step.step_index}`,
          type: "smoothstep",
          style: { stroke: "var(--border-strong)", strokeWidth: 2 },
        });
      }
    });

    // 2. Patched / Simulated branch
    if (hasPatch) {
      patchedSteps.forEach((step, index) => {
        const stepIndex = Number(step.step_index ?? index + 1);
        const isPatchPoint = stepIndex === patchStep;
        const isUnverified = Boolean(step.unverified);

        let style = simulatedStyle;
        if (isUnverified) style = unverifiedStyle;
        if (isPatchPoint) style = patchPointStyle;

        nds.push({
          id: `p-${stepIndex}`,
          position: { x: 380, y: index * 100 },
          data: {
            stepId: step.step_id,
            step,
            branch: "patched",
            label: renderLabel(
              stepIndex,
              stepName(step),
              isUnverified ? "unverified simulated path" : stepSubtitle(step),
              true
            ),
          },
          style,
        });

        if (index > 0) {
          const previous = Number(patchedSteps[index - 1].step_index ?? index);
          eds.push({
            id: `pe-${previous}-${stepIndex}`,
            source: `p-${previous}`,
            target: `p-${stepIndex}`,
            type: "smoothstep",
            animated: isUnverified,
            style: {
              stroke: "var(--purple)",
              strokeWidth: 2,
              strokeDasharray: isUnverified ? "5 5" : "0",
            },
          });
        }
      });

      // Connecting edge from original timeline to the simulated timeline
      if (patchStep !== null) {
        eds.push({
          id: `patch-${patchStep}`,
          source: `o-${patchStep}`,
          target: `p-${patchStep}`,
          type: "smoothstep",
          animated: true,
          style: { stroke: "var(--purple)", strokeWidth: 2, strokeDasharray: "4 4" },
        });
      }
    }

    return { nodes: nds, edges: eds };
  }, [originalSteps, patchedSteps, patchStep]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    const timer = window.setTimeout(() => {
      void flow?.fitView({ padding: 0.18, duration: 250 });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [flow, graph, setEdges, setNodes]);

  const activeNodes = nodes.map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
  }));

  return (
    <div
      style={{
        width: "100%",
        height,
        background: "var(--bg-base)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      <ReactFlow 
        nodes={activeNodes}
        edges={edges} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={setFlow}
        fitView 
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.5} 
        maxZoom={1.5} 
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
        onNodeClick={onNodeClick ? (_e, node) => {
          const step = node.data.step as Step | JsonObject | undefined;
          const branch = node.data.branch;
          if (step && (branch === "original" || branch === "patched")) {
            onNodeClick({ nodeId: node.id, branch, step });
          }
        } : undefined}
      >
        <Background color="var(--border-strong)" gap={16} size={1} />
        <Controls
          showInteractive
          position="top-right"
          orientation="horizontal"
          aria-label="Workflow graph controls"
          style={{
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            margin: "10px",
          }}
        />
        {!compact && (
            <MiniMap
              nodeColor={(n) => {
                if (n.style?.background?.toString().includes("var(--purple)"))
                  return "#B882FE";
                return "#B3B4C6";
              }}
              maskColor="rgba(245, 246, 248, 0.6)"
              style={{
                boxShadow: "var(--shadow-md)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)",
              }}
            />
        )}
      </ReactFlow>
      <style>{`
        .react-flow__node { cursor: grab; }
        .react-flow__node:active { cursor: grabbing; }
        .react-flow__node.selected { z-index: 4 !important; }
        .react-flow__node.selected > div {
          border-color: var(--blue) !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18), var(--shadow-md) !important;
        }
      `}</style>
    </div>
  );
}
