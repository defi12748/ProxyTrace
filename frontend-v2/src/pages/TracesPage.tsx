import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Play, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { RunCard } from "../components/traces/RunCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { SearchBar } from "../components/ui/SearchBar";
import { SortDropdown } from "../components/ui/SortDropdown";
import { StatusTabs } from "../components/ui/StatusTabs";
import { Pagination } from "../components/ui/Pagination";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonRow } from "../components/ui/Skeleton";
import { showToast } from "../components/ui/Toast";
import { ProxyTraceApi, getInitialApiBase } from "../api/client";
import type { Run } from "../api/types";
import { useIsMobile } from "../lib/useIsMobile";

const SORT_OPTIONS = [
  { id: "newest",  label: "Newest first",  description: "Most recent runs at the top" },
  { id: "oldest",  label: "Oldest first",  description: "Earliest runs at the top" },
  { id: "status",  label: "By status",     description: "Completed → Running → other" },
  { id: "issue",   label: "By issue key",  description: "Alphabetical by Jira key" },
];

const PAGE_SIZE = 12;

export function TracesPage({ initialIssueKey = "" }: { initialIssueKey?: string }) {
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const globalSearch = searchParams.get("search")?.trim() ?? "";

  const [runs, setRuns] = useState<Run[]>([]);
  const [issueFilter, setIssueFilter] = useState(globalSearch ? "" : initialIssueKey);
  const [search, setSearch] = useState(globalSearch);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState("all");
  const [traceKey, setTraceKey] = useState(initialIssueKey);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSearch(globalSearch);
    if (globalSearch) setIssueFilter("");
    setPage(1);
  }, [globalSearch]);

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const q = issueFilter.trim()
        ? `?jira_issue_key=${encodeURIComponent(issueFilter.trim())}&limit=100`
        : "?limit=100";
      const res = await api.get<{ runs: Run[] }>(`/runs${q}`);
      setRuns(res.runs);
      setPage(1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load runs", "error");
    } finally {
      setBusy(null);
      setLoading(false);
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

  /* Filter + sort + paginate client-side */
  const filtered = runs.filter((r) => {
    // Status tab filter
    if (statusTab !== "all" && r.status !== statusTab) return false;
    // Search filter
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.jira_issue_key?.toLowerCase().includes(q) ||
      r.run_id.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "oldest")  return new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime();
    if (sortKey === "status")  return a.status.localeCompare(b.status);
    if (sortKey === "issue")   return (a.jira_issue_key ?? "").localeCompare(b.jira_issue_key ?? "");
    return new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime();
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Tab counts
  const tabCounts = {
    all: runs.length,
    completed: runs.filter((r) => r.status === "completed").length,
    running:   runs.filter((r) => r.status === "running").length,
    failed:    runs.filter((r) => r.status === "failed").length,
  };

  return (
    <PageShell
      title="Traces"
      subtitle="All recorded agent runs — browse, filter, and inspect"
      actions={
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw size={13} />}
          loading={busy === "load"}
          onClick={() => void load()}
        >
          Refresh
        </Button>
      }
    >
      {/* Status filter tabs — dotrack-style pill filters */}
      <StatusTabs
        active={statusTab}
        onChange={(v) => { setStatusTab(v); setPage(1); }}
        tabs={[
          { value: "all",       label: "All Runs",  count: tabCounts.all },
          { value: "completed", label: "Completed",  count: tabCounts.completed },
          { value: "running",   label: "Running",    count: tabCounts.running },
          { value: "failed",    label: "Failed",     count: tabCounts.failed },
        ]}
      />

      {/* Toolbar */}
      <div
        id="tour-traces-search"
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          padding: "12px 16px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Left: filter by issue + sort */}
        <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: "200px", maxWidth: "260px" }}>
            <Input
              id="traces-filter"
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value.toUpperCase())}
              placeholder="Filter by issue key…"
              style={{ textTransform: "uppercase" }}
            />
          </div>

          <SearchBar value={search} onChange={setSearch} placeholder="Search runs…" />

          <SortDropdown
            options={SORT_OPTIONS}
            value={sortKey}
            onChange={setSortKey}
            label="Sort by"
          />
        </div>

        {/* Right: new trace CTA */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
            NEW TRACE
          </div>
          <div style={{ width: "160px" }}>
            <Input
              id="traces-new-key"
              value={traceKey}
              onChange={(e) => setTraceKey(e.target.value.toUpperCase())}
              placeholder="SCRUM-2"
              onKeyDown={(e) => { if (e.key === "Enter") void startTrace(); }}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Play size={13} />}
            loading={busy === "trace"}
            onClick={() => void startTrace()}
          >
            Trace Issue
          </Button>
        </div>
      </div>

      {/* Run grid */}
      <div id="tour-traces-list">
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "10px" }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : paged.length === 0 ? (
          <EmptyState
            icon={<Database size={22} />}
            title="No runs found"
            description={
              search || issueFilter
                ? `No traces matching your filters`
                : "Record your first trace using the input above."
            }
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
              gap: "10px",
            }}
          >
            {paged.map((run) => (
              <RunCard
                key={run.run_id}
                run={run}
                onClick={() => navigate(`/traces/${run.run_id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: count + pagination */}
      {sorted.length > 0 && (
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Showing {paged.length} of {sorted.length} run{sorted.length !== 1 ? "s" : ""}
            {issueFilter && ` for "${issueFilter}"`}
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </PageShell>
  );
}
