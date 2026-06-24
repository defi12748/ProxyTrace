import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { ToastContainer } from "./components/ui/Toast";
import { CommandPalette } from "./components/ui/CommandPalette";
import { TourProvider, useTour } from "./components/tour/TourProvider";
import { useIsMobile } from "./lib/useIsMobile";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const TracesPage = lazy(() => import("./pages/TracesPage").then((module) => ({ default: module.TracesPage })));
const TraceDetailPage = lazy(() => import("./pages/TraceDetailPage").then((module) => ({ default: module.TraceDetailPage })));
const ReplayStudioPage = lazy(() => import("./pages/ReplayStudioPage").then((module) => ({ default: module.ReplayStudioPage })));
const DriftPage = lazy(() => import("./pages/DriftPage").then((module) => ({ default: module.DriftPage })));
const RegressionPage = lazy(() => import("./pages/RegressionPage").then((module) => ({ default: module.RegressionPage })));
const JiraPanelApp = lazy(() => import("./pages/JiraPanelApp").then((module) => ({ default: module.JiraPanelApp })));

function GlobalTourTracker() {
  const { hasSeen, startTour } = useTour();
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;

    const timer = setTimeout(() => {
      const path = location.pathname;

      /* ── Dashboard ── */
      if (path === "/" && !hasSeen("dashboard-tour")) {
        startTour({
          id: "dashboard-tour",
          steps: [
            {
              target: "tour-sidebar",
              title: "Your Navigation Rail",
              description:
                "This sidebar is your primary navigation. Use it to move between the Dashboard, Trace History, Drift Monitor, and Regression Suite. The active section is always highlighted.",
              placement: "right",
            },
            {
              target: "tour-cmd-palette",
              title: "Global Command Palette",
              description:
                "Press Ctrl+K (or Cmd+K on Mac) anywhere to open the command palette. You can jump to any page, search for traces by Jira key, or trigger quick actions without reaching for the mouse.",
              placement: "bottom",
            },
            {
              target: "tour-recent-traces",
              title: "Recent Agent Runs",
              description:
                "This table shows your latest recorded agent executions, sorted by time. Each row shows the Jira issue the agent processed, its final status, and when it ran. Click any row to open the full Trace Inspector.",
              placement: "top",
            },
            {
              target: "tour-quick-trace",
              title: "Trigger a New Trace",
              description:
                "Enter a Jira issue key here (e.g. SCRUM-12) and hit Enter or click 'Trace'. ProxyTrace will instruct the agent to process that issue and record every decision, API call, and state change it makes.",
              placement: "left",
            },
          ],
        });

      /* ── Trace History ── */
      } else if (path === "/traces" && !hasSeen("traces-tour")) {
        startTour({
          id: "traces-tour",
          steps: [
            {
              target: "tour-traces-search",
              title: "Search Your Trace History",
              description:
                "Use this search bar to filter traces by Jira issue key, run status, or date. ProxyTrace stores every recorded agent run here so you can replay or compare them at any time.",
              placement: "bottom",
            },
            {
              target: "tour-traces-list",
              title: "Trace Rows",
              description:
                "Each row is one complete agent execution. The status badge shows whether the run completed, failed, or is still in progress. Click any row to open the three-panel Trace Inspector where you can step through every agent decision.",
              placement: "top",
            },
          ],
        });

      /* ── Drift Monitor ── */
      } else if (path === "/drift" && !hasSeen("drift-tour")) {
        startTour({
          id: "drift-tour",
          steps: [
            {
              target: "tour-drift-stats",
              title: "Drift Overview Metrics",
              description:
                "These cards summarize how often your agent runs hit unexpected schema changes or contract violations. A high drift rate usually means the Jira API changed its response shape and the agent needs to adapt.",
              placement: "bottom",
            },
            {
              target: "tour-drift-list",
              title: "Individual Drift Events",
              description:
                "Each item here is a specific step in a run where the agent observed data that did not match the expected schema. Click an event to jump directly to that step inside the Trace Inspector.",
              placement: "top",
            },
          ],
        });

      /* ── Regression Suite ── */
      } else if (path === "/regression" && !hasSeen("regression-tour")) {
        startTour({
          id: "regression-tour",
          steps: [
            {
              target: "tour-regression-run-all",
              title: "Run All Regression Tests",
              description:
                "Click here to replay every saved test at once. ProxyTrace re-executes each recorded exploratory run and checks whether the agent produces the same verdict. This catches regressions automatically when agent logic or the Jira API changes.",
              placement: "bottom",
            },
            {
              target: "tour-regression-list",
              title: "Saved Test Cases",
              description:
                "Each item is a 'what-if' simulation you promoted from the Replay Studio. It stores the patch you applied, the expected verdict, and the historical pass rate. You can run a single test or delete tests that are no longer relevant.",
              placement: "top",
            },
          ],
        });

      /* ── Trace Inspector (detail page) ── */
      } else if (
        /^\/traces\/[^/]+$/.test(path) &&
        !hasSeen("trace-detail-tour")
      ) {
        startTour({
          id: "trace-detail-tour",
          steps: [
            {
              target: "tour-trace-timeline",
              title: "Execution Timeline",
              description:
                "The left panel lists every step the agent executed in order, including LLM calls, tool calls, and state snapshots. Click any step to open its full details in the Inspector panel.",
              placement: "right",
            },
            {
              target: "tour-step-inspector",
              title: "Step Inspector",
              description:
                "The center panel shows deep details for the selected step: the human-readable story of what happened, key facts like confidence scores and routing decisions, a JSON diff of how the agent\'s state changed, and the raw payload.",
              placement: "bottom",
            },
            {
              target: "tour-trajectory-graph",
              title: "Trajectory Graph",
              description:
                "This graph renders the agent\'s full decision path as a flow diagram. Nodes represent steps; edges show the sequence. Click a node to jump directly to that step in the Timeline. When a simulation is active, the patched path is shown in purple.",
              placement: "top",
            },
            {
              target: "tour-replay-controls",
              title: "Replay Controls",
              description:
                "Use \'Safe Replay\' to re-run the trace from stored data without touching Jira. Use \'Simulate Route\' to inject a hypothetical routing decision and see how the agent responds. Results appear inline — or open the full Replay Studio for a deeper comparison view.",
              placement: "left",
            },
          ],
        });

      /* ── Replay Studio ── */
      } else if (path.endsWith("/replay") && !hasSeen("replay-studio-tour")) {
        startTour({
          id: "replay-studio-tour",
          steps: [
            {
              target: "tour-replay-safe",
              title: "Safe Replay",
              description:
                "Run the trace again using only recorded data. All write operations (Jira comments, field updates) are intercepted and blocked. This lets you verify the agent is deterministic without any side-effects on your live Jira instance.",
              placement: "right",
            },
            {
              target: "tour-replay-whatif",
              title: "What-If Simulation",
              description:
                "Choose a routing destination (e.g. PLATFORM, INFRASTRUCTURE) and click \'Simulate Route Change\'. ProxyTrace replaces the agent\'s real routing tool output with your chosen value and re-runs the downstream steps — showing you exactly how the agent would have behaved on a different project.",
              placement: "right",
            },
            {
              target: "tour-replay-results",
              title: "Comparison Results",
              description:
                "After running a simulation, the right panel shows an AI-evaluated verdict on whether the behavior change is \'safe\'. The side-by-side timeline highlights the exact steps that diverged from the original. Once satisfied, promote the simulation to a permanent regression test.",
              placement: "left",
            },
          ],
        });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [location.pathname, hasSeen, isMobile, startTour]);

  return null;
}


export function App({
  initialIssueKey = "",
  useHashRouter = false,
}: {
  initialIssueKey?: string;
  useHashRouter?: boolean;
}) {
  const Router = useHashRouter ? HashRouter : BrowserRouter;

  return (
    <Router>
      <AppFrame initialIssueKey={initialIssueKey} />
    </Router>
  );
}

function AppFrame({ initialIssueKey = "" }: { initialIssueKey?: string }) {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  return (
    <>
      {/* Full-viewport row: sidebar | main column */}
      <div className="app-layout">
        <Sidebar
          isMobile={isMobile}
          mobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Right column: sticky topbar + scrollable content */}
        <div className="app-main">
          <TopBar
            isMobile={isMobile}
            onToggleSidebar={isMobile ? () => setMobileNavOpen((open) => !open) : undefined}
          />

          <main className="app-content">
            <div className="page-body">
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/"                      element={<DashboardPage initialIssueKey={initialIssueKey} />} />
                  <Route path="/traces"                element={<TracesPage initialIssueKey={initialIssueKey} />} />
                  <Route path="/traces/:runId"         element={<TraceDetailPage />} />
                  <Route path="/traces/:runId/replay"  element={<ReplayStudioPage />} />
                  <Route path="/drift"                 element={<DriftPage />} />
                  <Route path="/regression"            element={<RegressionPage />} />
                  <Route path="*"                      element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      <CommandPalette />
      <ToastContainer />
      <GlobalTourTracker />
    </>
  );
}

export function AppWrapper() {
  const [runtime, setRuntime] = useState<{
    ready: boolean;
    isForge: boolean;
    issueKey: string;
  }>({ ready: false, isForge: false, issueKey: "" });
  const isPanelPreview = window.location.pathname === "/panel-preview";

  useEffect(() => {
    if (isPanelPreview) {
      setRuntime({ ready: true, isForge: false, issueKey: "SCRUM-1" });
      return;
    }

    import("@forge/bridge")
      .then(({ view }) => {
        view.getContext()
          .then((context) => {
            const issueKey = (context as {
              extension?: { issue?: { key?: string } };
            })?.extension?.issue?.key;
            setRuntime({ ready: true, isForge: true, issueKey: issueKey ?? "" });
          })
          .catch(() => {
            setRuntime({ ready: true, isForge: false, issueKey: "" });
          });
      })
      .catch(() => {
        setRuntime({ ready: true, isForge: false, issueKey: "" });
      });
  }, [isPanelPreview]);

  if (!runtime.ready) {
    return null;
  }

  // Keep the focused widget available for local review, but Forge itself gets
  // the complete console so tracing, history, replay, and regression stay intact.
  if (isPanelPreview) {
    return (
      <div style={{
        width: "350px",
        margin: "40px auto",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        background: "var(--bg-base)",
        overflow: "hidden",
        minHeight: "500px"
      }}>
        <div style={{ background: "var(--bg-surface)", padding: "10px", borderBottom: "1px solid var(--border)", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textAlign: "center" }}>
          Jira Sidebar Preview (350px)
        </div>
        <Suspense fallback={<PageLoading compact />}><JiraPanelApp /></Suspense>
        <ToastContainer />
      </div>
    );
  }

  if (runtime.isForge) {
    return (
      <>
        <Suspense fallback={<PageLoading compact />}><JiraPanelApp initialIssueKey={runtime.issueKey} /></Suspense>
        <ToastContainer />
      </>
    );
  }

  return (
    <TourProvider>
      <App
        initialIssueKey={runtime.issueKey}
        useHashRouter={runtime.isForge}
      />
    </TourProvider>
  );
}

function PageLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "route-loading route-loading--compact" : "route-loading"} role="status">
      <span className="route-loading__spinner" />
      <span>Loading workspace…</span>
    </div>
  );
}

function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "60vh",
        gap: "12px",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: "48px", fontWeight: 800, color: "var(--border-strong)" }}>404</span>
      <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
        Page not found.{" "}
        <a href="/" style={{ color: "var(--purple-text)" }}>Go to dashboard</a>
      </p>
    </div>
  );
}
