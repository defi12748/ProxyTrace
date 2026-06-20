/* ============================================================
   ProxyTrace v2 — API Types
   (Identical to frontend/src/api.ts — preserved, not rewritten)
   ============================================================ */

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
    safety_guarantee?: boolean;
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

/* Drift check result from POST /runs/{run_id}/drift/check-all */
export type DriftFinding = {
  kind: string;
  old_hash: string | null;
  new_hash: string | null;
  detail: string;
};

export type DriftStepResult = {
  step_id: string;
  step_index: number;
  tool_name: string;
  drifted: boolean;
  finding_count: number;
  findings: DriftFinding[];
};

export type DriftCheckResult = {
  run_id: string;
  steps_checked: number;
  steps_drifted: number;
  all_clear: boolean;
  results: DriftStepResult[];
};

/* Jira issue from GET /jira/issues/{issue_key} */
export type JiraIssue = {
  key: string;
  summary: string;
  description: string | null;
  status: string;
  assignee: string | null;
  reporter: string | null;
  priority: string | null;
  issue_type: string | null;
  created: string | null;
  updated: string | null;
  url: string | null;
};
