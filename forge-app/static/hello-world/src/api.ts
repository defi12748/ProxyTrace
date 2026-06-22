export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type Run = {
  run_id: string;
  agent_id: string;
  jira_issue_key: string | null;
  workspace_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  metadata: JsonObject;
};

export type Step = {
  step_id: string;
  run_id: string;
  step_index: number;
  step_type: string;
  payload: JsonObject;
  snapshot: JsonObject;
  recorded_at: string | null;
};

export type Warning = {
  warning_id: string;
  run_id: string;
  step_id: string | null;
  warning_type: string;
  old_hash: string | null;
  new_hash: string | null;
  surfaced_at: string | null;
  details: string;
};

export type RunDetail = {
  run: Run;
  step_count: number;
  steps: Step[];
};

export type StrictReplay = {
  replay_id: string;
  run_id: string;
  verdict: JsonObject & {
    determinism_rate?: number;
    live_call_count?: number;
    side_effect_block_count?: number;
    step_count?: number;
    replayed_steps?: JsonObject[];
  };
};

export type ExploratoryReplay = {
  replay_id: string;
  run_id: string;
  verdict: JsonObject & {
    patched_steps?: JsonObject[];
    diff?: JsonObject;
    evaluation?: JsonObject;
    unverified_step_count?: number;
    live_call_count?: number;
  };
};

export type RegressionItem = {
  test_id: string;
  run_id: string;
  replay_id: string | null;
  assertions: JsonObject;
  promoted_at: string | null;
  last_run_at: string | null;
  pass_count: number;
  fail_count: number;
};

export type RegressionRunResult = {
  total: number;
  passed: number;
  failed: number;
  results: JsonObject[];
};

export class ProxyTraceApi {
  constructor(private readonly baseUrl: string) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...((import.meta.env.VITE_PROXYTRACE_API_KEY as string | undefined)
          ? { Authorization: `Bearer ${import.meta.env.VITE_PROXYTRACE_API_KEY}` }
          : {}),
        "X-ProxyTrace-Workspace-ID":
          (import.meta.env.VITE_PROXYTRACE_WORKSPACE_ID as string | undefined) ||
          "local-demo",
        ...(init?.headers ?? {})
      }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }
    return (await response.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: JsonObject): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined
    });
  }
}

export function compactId(id?: string | null): string {
  if (!id) return "none";
  return id.length <= 10 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "pending";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function asRecord(value: JsonValue | undefined): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}
