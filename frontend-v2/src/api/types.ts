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
