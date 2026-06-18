import { ProxyTraceApi, type JsonObject, type Run } from "./api";

const SYSTEM_PROMPT =
  "You are a Jira triage agent. Inspect the ticket, choose the best project board, validate the project key with get_project_key, then update the ticket exactly once.";

const DEFAULT_TICKET = {
  issueKey: "DEMO-1",
  summary: "API deploy pipeline fails for enterprise customer",
  description:
    "The platform release pipeline fails during deployment after an API change."
};

type StartRunResponse = { run: Run };
type ToolResponse = { response?: JsonObject };

export async function recordDemoTrace(api: ProxyTraceApi): Promise<string> {
  const started = await api.post<StartRunResponse>("/runs", {
    agent_id: "jira-triage-demo",
    jira_issue_key: DEFAULT_TICKET.issueKey,
    workspace_id: "vectors-demo",
    metadata: {
      summary: DEFAULT_TICKET.summary,
      description: DEFAULT_TICKET.description,
      source: "frontend_console"
    }
  });
  const runId = started.run.run_id;

  await api.post("/llm/capture", {
    run_id: runId,
    model: "gemini-3.1-flash-lite",
    system_prompt: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Issue ${DEFAULT_TICKET.issueKey}: ${DEFAULT_TICKET.summary}\n\nDescription: ${DEFAULT_TICKET.description}`
      }
    ],
    response: {
      intent: "route_ticket",
      next_tool: "get_project_key",
      candidate_board: "PLATFORM",
      confidence: 0.92
    },
    token_usage: { prompt_tokens: 118, completion_tokens: 42 },
    snapshot: {
      ticket: {
        issue_key: DEFAULT_TICKET.issueKey,
        summary: DEFAULT_TICKET.summary,
        description: DEFAULT_TICKET.description
      }
    }
  });

  const lookup = await api.post<ToolResponse>("/mcp", {
    run_id: runId,
    tool_name: "get_project_key",
    params: {
      issue_key: DEFAULT_TICKET.issueKey,
      summary: DEFAULT_TICKET.summary,
      description: DEFAULT_TICKET.description
    },
    snapshot: { candidate_board: "PLATFORM" }
  });

  const projectKey =
    typeof lookup.response?.project_key === "string"
      ? lookup.response.project_key
      : "PLATFORM";

  await api.post("/llm/capture", {
    run_id: runId,
    model: "gemini-3.1-flash-lite",
    system_prompt: SYSTEM_PROMPT,
    messages: [
      {
        role: "tool",
        content: JSON.stringify(lookup.response ?? {})
      }
    ],
    response: {
      intent: "update_ticket",
      next_tool: "update_ticket",
      board: projectKey,
      confidence: 0.95
    },
    token_usage: { prompt_tokens: 96, completion_tokens: 35 },
    snapshot: { validated_project_key: projectKey }
  });

  const update = await api.post<ToolResponse>("/mcp", {
    run_id: runId,
    tool_name: "update_ticket",
    params: {
      issue_key: DEFAULT_TICKET.issueKey,
      board: projectKey,
      reason:
        "Routing selected from ticket semantics and validated through get_project_key."
    },
    snapshot: { validated_project_key: projectKey }
  });

  await api.post(`/runs/${runId}/complete`, {
    status: "completed",
    metadata: {
      final_board: projectKey,
      update_status: update.response?.status ?? "unknown"
    }
  });

  return runId;
}
