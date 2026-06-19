import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Play, RefreshCw } from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { RunCard } from "../components/traces/RunCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { showToast } from "../components/ui/Toast";
import { ProxyTraceApi, getInitialApiBase } from "../api/client";
import type { Run } from "../api/types";

export function TracesPage() {
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);

  const [runs, setRuns] = useState<Run[]>([]);
  const [issueFilter, setIssueFilter] = useState("");
  const [traceKey, setTraceKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const q = issueFilter.trim()
        ? `?jira_issue_key=${encodeURIComponent(issueFilter.trim())}&limit=50`
        : "?limit=50";
      const res = await api.get<{ runs: Run[] }>(`/runs${q}`);
      setRuns(res.runs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load runs", "error");
    } finally {
      setBusy(null);
    }
  }, [api, issueFilter]);

  useEffect(() => { void load(); }, [load]);

  async function startTrace() {
    const key = traceKey.trim().toUpperCase();
    if (!key) { showToast("Enter a Jira issue key", "error"); return; }
    setBusy("trace");
    try {
      await api.post<{ run_id: string }>("/jira/trace", { issue_key: key });
      showToast(`Trace started for ${key}`, "success");
      setTraceKey("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Trace failed", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageShell
      title="Traces"
      subtitle="All recorded agent runs — browse, filter, and inspect"
      actions={
        <Button
          variant="ghost"
          icon={<RefreshCw size={14} />}
          loading={busy === "load"}
          onClick={() => void load()}
        >
          Refresh
        </Button>
      }
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px", maxWidth: "320px" }}>
          <Input
            label="Filter by issue key"
            id="traces-filter"
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value.toUpperCase())}
            placeholder="SCRUM-1"
          />
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ width: "200px" }}>
            <Input
              label="New trace"
              id="traces-new-key"
              value={traceKey}
              onChange={(e) => setTraceKey(e.target.value.toUpperCase())}
              placeholder="SCRUM-2"
              onKeyDown={(e) => { if (e.key === "Enter") void startTrace(); }}
            />
          </div>
          <Button
            variant="primary"
            icon={<Play size={14} />}
            loading={busy === "trace"}
            onClick={() => void startTrace()}
            style={{ marginTop: "17px" }}
          >
            Trace Issue
          </Button>
        </div>
      </div>

      {/* Run grid */}
      {runs.length === 0 && busy !== "load" ? (
        <EmptyState
          icon={<Database size={22} />}
          title="No runs found"
          description={issueFilter ? `No traces matching "${issueFilter}"` : "Record your first trace using the input above."}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "10px",
          }}
        >
          {runs.map((run) => (
            <RunCard key={run.run_id} run={run} />
          ))}
        </div>
      )}

      {/* Count */}
      {runs.length > 0 && (
        <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "right" }}>
          Showing {runs.length} run{runs.length !== 1 ? "s" : ""}
          {issueFilter && ` for "${issueFilter}"`}
        </div>
      )}
    </PageShell>
  );
}
