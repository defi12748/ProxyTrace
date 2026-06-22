/* ============================================================
   ProxyTrace v2 — Business Logic Utilities
   (All functions preserved verbatim from frontend/src/App.tsx)
   ============================================================ */

import type { JsonObject, Step, Warning } from "../api/types";
import { asRecord } from "../api/client";
import type { Edge, Node } from "@xyflow/react";
import type { ReactNode } from "react";

export type StepStory = {
  title: string;
  why: string;
  facts: Array<[string, unknown]>;
};

export const ROUTE_OPTIONS = [
  { value: "PLATFORM", label: "Platform" },
  { value: "SECURITY", label: "Customer Security" },
  { value: "BILLING", label: "Billing" },
  { value: "INFRA", label: "Infrastructure" },
];

export function warningSummary(warning: Warning): string {
  const tool = warning.details.match(/for ['"]([^'"]+)['"]/)?.[1];
  const step = warning.details.match(/at step (\d+)/i)?.[1];
  const subject = tool
    ? `${tool}${step ? ` at step ${step}` : ""}`
    : step
      ? `The tool call at step ${step}`
      : "A recorded tool call";

  if (warning.warning_type.includes("output_schema")) {
    return `${subject} returned data in a different format. Replay results may be affected.`;
  }
  if (warning.warning_type.includes("input_schema")) {
    return `${subject} received data in a different format. Replay results may be affected.`;
  }
  if (warning.warning_type.includes("descriptor")) {
    return `${subject} has a changed tool definition. Review this run before relying on replay results.`;
  }
  return `${subject} changed from the recorded workflow baseline.`;
}

/* ---- Step display helpers ---- */

export function stepName(step: Step | JsonObject): string {
  const payload = asRecord(step.payload);
  if (step.step_type === "tool") {
    const toolName = String(payload.tool_name ?? "tool_call");
    if (toolName === "get_project_key") return "Check routing target";
    if (toolName === "update_ticket") return "Record ticket update";
    return toolName;
  }
  return "Agent reasoning";
}

export function stepSubtitle(step: Step | JsonObject): string {
  const payload = asRecord(step.payload);
  if (step.step_type === "tool") {
    const params = asRecord(payload.params);
    const response = asRecord(payload.response);
    const route = params.board ?? response.board ?? response.project_key;
    const status = response.status ?? payload.status ?? "recorded";
    return route ? `Route: ${route}` : `Status: ${status}`;
  }
  const text = extractResponseText(payload);
  if (text) return truncateText(text, 96);
  return `Model: ${payload.model ?? "recorded"}`;
}

export function extractResponseText(payload: JsonObject): string {
  const response = asRecord(payload.response);
  const candidates = response.candidates;
  if (!Array.isArray(candidates)) return "";
  for (const candidate of candidates) {
    const content = asRecord(asRecord(candidate as JsonObject).content);
    const parts = content.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const text = asRecord(part as JsonObject).text;
      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }
    }
  }
  return "";
}

export function truncateText(value: unknown, maxLength = 180): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function formatFactValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  if (typeof value === "number") return confidenceLabel(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value ?? "none");
}

export function confidenceLabel(value: unknown): string {
  if (typeof value !== "number") return "pending";
  return `${Math.round(value * 100)}%`;
}

/* ---- Step story (inspector narrative) ---- */

export function stepStory(step: Step): StepStory {
  const payload = asRecord(step.payload);
  const snapshot = asRecord(step.snapshot);
  const response = asRecord(payload.response);
  const params = asRecord(payload.params);
  const toolName = String(payload.tool_name ?? "");

  if (step.step_type === "tool" && toolName === "get_project_key") {
    return {
      title: `Routing check returned ${formatFactValue(response.project_key)}`,
      why: "This is the tool result the agent trusted before deciding where the Jira ticket should go.",
      facts: [
        ["Issue", params.issue_key ?? response.issue_key],
        ["Chosen route", response.project_key],
        ["Confidence", response.confidence],
        ["Evidence", response.evidence],
        ["Source", response.source],
        [
          "Drift check",
          payload.status === "ok"
            ? "passed at record time"
            : payload.status,
        ],
      ],
    };
  }

  if (step.step_type === "tool" && toolName === "update_ticket") {
    return {
      title: `Ticket update recorded for ${formatFactValue(params.board ?? response.board)}`,
      why: "This is the write action. Safe replay blocks this step so testing never changes Jira twice.",
      facts: [
        ["Issue", params.issue_key ?? response.issue_key],
        ["Route used", params.board ?? response.board],
        ["Replay behavior", "blocked during safe replay"],
        ["Recorded status", response.status],
        ["Side effect", payload.side_effect_class],
      ],
    };
  }

  if (step.step_type === "llm") {
    const validatedKey = snapshot.validated_project_key;
    const responseText = extractResponseText(payload);
    return {
      title: validatedKey
        ? `Agent reasoned after route ${formatFactValue(validatedKey)}`
        : "Agent inspected the ticket",
      why: "This is the model reasoning checkpoint. It shows what the agent saw before the next tool call.",
      facts: [
        ["Model", payload.model],
        ["Ticket", asRecord(snapshot.ticket).issue_key],
        ["Known route", validatedKey],
        [
          "Response",
          responseText
            ? truncateText(responseText, 260)
            : "No text response captured",
        ],
      ],
    };
  }

  return {
    title: "Recorded step",
    why: "ProxyTrace captured this step so it can be replayed and inspected later.",
    facts: [
      ["Type", step.step_type],
      ["Status", payload.status],
    ],
  };
}

/* ---- Misc ---- */

export function jsonText(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

export function pickFirstToolStep(
  steps: Step[],
  toolName: string
): number | null {
  const step = steps.find(
    (item) =>
      item.step_type === "tool" &&
      String(asRecord(item.payload).tool_name) === toolName
  );
  return step?.step_index ?? null;
}

/* ---- ReactFlow graph builder ---- */

type FlowGraph = { nodes: Node[]; edges: Edge[] };

// The actual label JSX is injected from the component layer.
export type NodeLabelRenderer = (
  step: Step | JsonObject,
  stepIndex: number,
  isUnverified: boolean
) => ReactNode;

export function buildGraph(
  steps: Step[],
  patchedSteps: JsonObject[],
  patchStep: number | null,
  renderLabel: NodeLabelRenderer
): FlowGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const hasPatch = patchedSteps.length > 0;

  steps.forEach((step, index) => {
    const isPatchPoint = step.step_index === patchStep;
    nodes.push({
      id: `o-${step.step_index}`,
      position: { x: 20, y: index * 100 },
      data: { label: renderLabel(step, step.step_index, false), stepId: step.step_id },
      className: isPatchPoint ? "pt-node pt-original pt-patch-point" : "pt-node pt-original",
    });
    if (index > 0) {
      edges.push({
        id: `oe-${steps[index - 1].step_index}-${step.step_index}`,
        source: `o-${steps[index - 1].step_index}`,
        target: `o-${step.step_index}`,
        type: "smoothstep",
        style: { stroke: "rgba(99,179,237,0.4)", strokeWidth: 2 },
      });
    }
  });

  if (hasPatch) {
    patchedSteps.forEach((step, index) => {
      const stepIndex = Number(step.step_index ?? index + 1);
      const isPatchPoint = stepIndex === patchStep;
      const isUnverified = Boolean(step.unverified);
      nodes.push({
        id: `p-${stepIndex}`,
        position: { x: 440, y: index * 100 },
        data: { label: renderLabel(step, stepIndex, isUnverified), stepId: step.step_id },
        className: [
          "pt-node pt-patched",
          isPatchPoint ? "pt-patch-point" : "",
          isUnverified ? "pt-unverified" : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
      if (index > 0) {
        const previous = Number(patchedSteps[index - 1].step_index ?? index);
        edges.push({
          id: `pe-${previous}-${stepIndex}`,
          source: `p-${previous}`,
          target: `p-${stepIndex}`,
          type: "smoothstep",
          animated: isUnverified,
          style: {
            stroke: isUnverified
              ? "rgba(248,113,113,0.6)"
              : "rgba(167,139,250,0.5)",
            strokeWidth: 2,
          },
        });
      }
    });

    if (patchStep !== null) {
      edges.push({
        id: `patch-${patchStep}`,
        source: `o-${patchStep}`,
        target: `p-${patchStep}`,
        type: "smoothstep",
        animated: true,
        style: { stroke: "rgba(251,191,36,0.8)", strokeWidth: 2.5 },
      });
    }
  }

  return { nodes, edges };
}
