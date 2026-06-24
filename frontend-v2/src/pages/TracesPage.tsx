import { useCallback, useEffect, useMemo, useState, ReactNode } from "react";
import { Database, LayoutGrid, Play, RefreshCw, Rows3 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { RunCard } from "../components/traces/RunCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { SearchBar } from "../components/ui/SearchBar";
import { SortDropdown } from "../components/ui/SortDropdown";
import { StatusTabs } from "../components/ui/StatusTabs";
import { Pagination } from "../components/ui/Pagination";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonRow, Skeleton } from "../components/ui/Skeleton";
import { Badge, statusColor } from "../components/ui/Badge";
import { showToast } from "../components/ui/Toast";
import { ProxyTraceApi, getInitialApiBase, formatDate, compactId } from "../api/client";
import type { Run } from "../api/types";
import { useIsMobile } from "../lib/useIsMobile";

const SORT_OPTIONS = [
  { id: "newest",  label: "Newest first",  description: "Most recent runs at the top" },
  { id: "oldest",  label: "Oldest first",  description: "Earliest runs at the top" },
  { id: "status",  label: "By status",     description: "Completed → Running → other" },
  { id: "issue",   label: "By issue key",  description: "Alphabetical by Jira key" },
];

const PAGE_SIZE = 12;

type ViewMode = "grid" | "table";


/* Pill-style switch — visually consistent with StatusTabs */
function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { id: ViewMode; icon: ReactNode; label: string }[] = [
    { id: "grid",  icon: <LayoutGrid size={14} />, label: "Grid" },
    { id: "table", icon: <Rows3 size={14} />,      label: "Table" },
  ];
  return (
    <div
      role="tablist"
      aria-label="View mode"
      style={{
        display: "flex",
        gap: "2px",
        padding: "2px",
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        flexShrink: 0,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            aria-label={`${opt.label} view`}
            title={`${opt.label} view`}
            onClick={() => onChange(opt.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              border: "none",
              borderRadius: "calc(var(--radius-md) - 2px)",
              background: active ? "var(--bg-surface)" : "transparent",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all var(--transition)",
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

export function TracesPage({ initialIssueKey = "" }: { initialIssueKey?: string }) {
  const [apiBase] = useState(getInitialApiBase);
  const api = useMemo(() => new ProxyTraceApi(apiBase), [apiBase]);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const globalSearch = searchParams.get("search")?.trim() ?? "";

  const [runs, setRuns] = useState<Run[]>([]);
  const [search, setSearch] = useState(globalSearch || initialIssueKey);
  const [queryKey, setQueryKey] = useState(globalSearch ? "" : initialIssueKey);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState("all");
  const [traceKey, setTraceKey] = useState(initialIssueKey);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    setSearch(globalSearch);
    if (globalSearch) setQueryKey("");
    setPage(1);
  }, [globalSearch]);

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const key = queryKey.trim();
      const q = key
        ? `?jira_issue_key=${encodeURIComponent(key)}&limit=100`
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
  }, [api, queryKey]);

  useEffect(() => { void load(); }, [load]);

  function runQuery(value: string) {
    setQueryKey(value.trim().toUpperCase());
  }

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

  const filtered = runs.filter((r) => {
    if (statusTab !== "all" && r.status !== statusTab) return false;
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

  const tabCounts = {
    all: runs.length,
    completed: runs.filter((r) => r.status === "completed").length,
    running:   runs.filter((r) => r.status === "running").length,
    failed:    runs.filter((r) => r.status === "failed").length,
  };

  const tableCols = "150px 140px 1fr 160px 160px 100px";

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
        <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            onSubmit={runQuery}
            placeholder="Search runs… (Enter to load by issue key)"
          />

          <SortDropdown
            options={SORT_OPTIONS}
            value={sortKey}
            onChange={setSortKey}
            label="Sort by"
          />
        </div>

        {/* Right: new trace CTA + view toggle */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
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

          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Run list */}
      <div id="tour-traces-list">
        {loading ? (
          viewMode === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "10px" }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <Skeleton width="100%" height="24px" radius="12px" />
                </div>
              ))}
            </div>
          )
        ) : paged.length === 0 ? (
          <EmptyState
            icon={<Database size={22} />}
            title="No runs found"
            description={
              search || queryKey
                ? `No traces matching your filters`
                : "Record your first trace using the input above."
            }
          />
        ) : viewMode === "grid" ? (
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
        ) : (
          /* Table view — styled like the Drift page table */
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              overflow: "hidden",
            }}
          >
            <div className="table-scroll">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: tableCols,
                  minWidth: "820px",
                  gap: "8px",
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--text-muted)",
                  background: "var(--bg-base)",
                }}
              >
                <span>Run</span>
                <span>Status</span>
                <span>Issue</span>
                <span>Started</span>
                <span>Completed</span>
                <span></span>
              </div>

              {paged.map((run) => (
                <button
                  key={run.run_id}
                  className="premium-row"
                  onClick={() => navigate(`/traces/${run.run_id}`)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: tableCols,
                    minWidth: "820px",
                    gap: "8px",
                    padding: "10px 16px",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background var(--transition)",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-raised)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--purple-text)" }}>
                    <Link
                      to={`/traces/${run.run_id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "var(--purple-text)", textDecoration: "none" }}
                    >
                      {compactId(run.run_id)}
                    </Link>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Badge color={statusColor(run.status)}>{run.status}</Badge>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {run.jira_issue_key ?? "—"}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
  {run.started_at ? formatDate(run.started_at) : "—"}
</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {run.completed_at ? formatDate(run.completed_at) : "—"}
                  </span>
                  <span />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: count + pagination */}
      {sorted.length > 0 && (
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Showing {paged.length} of {sorted.length} run{sorted.length !== 1 ? "s" : ""}
            {queryKey && ` for "${queryKey}"`}
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