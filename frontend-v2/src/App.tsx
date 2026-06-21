import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { ToastContainer } from "./components/ui/Toast";
import { CommandPalette } from "./components/ui/CommandPalette";
import { DashboardPage } from "./pages/DashboardPage";
import { TracesPage } from "./pages/TracesPage";
import { TraceDetailPage } from "./pages/TraceDetailPage";
import { ReplayStudioPage } from "./pages/ReplayStudioPage";
import { DriftPage } from "./pages/DriftPage";
import { RegressionPage } from "./pages/RegressionPage";
import { TourProvider, useTour } from "./components/tour/TourProvider";
import { JiraPanelApp } from "./pages/JiraPanelApp";
import { useState } from "react";

function GlobalTourTracker() {
  const { hasSeen, startTour } = useTour();
  const location = useLocation();

  useEffect(() => {
    // Delay slightly so the page renders fully before spotlight measurement
    const timer = setTimeout(() => {
      const path = location.pathname;

      if (path === "/" && !hasSeen("dashboard-tour")) {
        startTour({
          id: "dashboard-tour",
          steps: [
            {
              target: "tour-sidebar",
              title: "Welcome to ProxyTrace!",
              description: "This is your main navigation. From here you can access your observability Dashboard, trace History, Drift alerts, and Regression test suites.",
              placement: "right",
              icon: "👋",
            },
            {
              target: "tour-quick-trace",
              title: "Start a Trace",
              description: "Want to test an agent run? Enter a Jira issue key here to instantly trigger a trace and watch the agent's thought process live.",
              placement: "left",
              icon: "🚀",
            },
            {
              target: "tour-cmd-palette",
              title: "Command Palette",
              description: "Press Cmd+K (or Ctrl+K) anywhere to quickly search for traces, jump to pages, or execute common actions.",
              placement: "bottom",
              icon: "⌨️",
            },
            {
              target: "tour-recent-traces",
              title: "Analyze Runs",
              description: "Click on any recent trace to open the Replay Studio. There you can see every API call, identify drift, and safely replay agent decisions.",
              placement: "top",
              icon: "🔍",
            },
          ],
        });
      } else if (path === "/traces" && !hasSeen("traces-tour")) {
        startTour({
          id: "traces-tour",
          steps: [
            {
              target: "tour-traces-search",
              title: "Trace History",
              description: "Here you can search and filter through all your past agent runs.",
              placement: "bottom",
              icon: "📋",
            },
            {
              target: "tour-traces-list",
              title: "Trace Details",
              description: "Click on any trace row to open the Replay Studio and inspect the detailed execution steps.",
              placement: "top",
              icon: "🔍",
            }
          ]
        });
      } else if (path === "/drift" && !hasSeen("drift-tour")) {
        startTour({
          id: "drift-tour",
          steps: [
            {
              target: "tour-drift-stats",
              title: "Drift Analysis",
              description: "This page automatically monitors your agent runs for unexpected deviations, such as missing tool calls or changed payload structures.",
              placement: "bottom",
              icon: "🛡️",
            },
            {
              target: "tour-drift-list",
              title: "Drift Alerts",
              description: "Review individual drift events. You can dive into the exact step where the agent deviated from the baseline.",
              placement: "top",
              icon: "⚠️",
            }
          ]
        });
      } else if (path === "/regression" && !hasSeen("regression-tour")) {
        startTour({
          id: "regression-tour",
          steps: [
            {
              target: "tour-regression-run-all",
              title: "Automated Testing",
              description: "You can save exploratory agent runs as Regression Tests. Use this button to re-run all your saved tests at once.",
              placement: "bottom",
              icon: "🧪",
            },
            {
              target: "tour-regression-list",
              title: "Test Suites",
              description: "Each saved test tracks its pass/fail rate over time. Click 'Run' to execute an individual test suite.",
              placement: "top",
              icon: "📊",
            }
          ]
        });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [location.pathname, hasSeen, startTour]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      {/* Full-viewport row: sidebar | main column */}
      <div className="app-layout">
        <Sidebar />

        {/* Right column: sticky topbar + scrollable content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <TopBar />

          <main className="app-content">
            <div className="page-body">
              <Routes>
                <Route path="/"                      element={<DashboardPage />} />
                <Route path="/traces"                element={<TracesPage />} />
                <Route path="/traces/:runId"         element={<TraceDetailPage />} />
                <Route path="/traces/:runId/replay"  element={<ReplayStudioPage />} />
                <Route path="/drift"                 element={<DriftPage />} />
                <Route path="/regression"            element={<RegressionPage />} />
                <Route path="*"                      element={<NotFound />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>

      <CommandPalette />
      <ToastContainer />
      <GlobalTourTracker />
    </BrowserRouter>
  );
}

export function AppWrapper() {
  const [isForge, setIsForge] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user wants to force the panel preview locally
    if (window.location.pathname === "/panel-preview") {
      setIsForge(true);
      return;
    }

    // Check if we're running inside the Atlassian Forge environment
    import("@forge/bridge")
      .then(({ view }) => {
        view.getContext()
          .then((context) => {
            setIsForge(Boolean(context));
          })
          .catch(() => {
            setIsForge(false);
          });
      })
      .catch(() => {
        setIsForge(false);
      });
  }, []);

  if (isForge === null) {
    return null; // Loading environment state
  }

  if (isForge) {
    if (window.location.pathname === "/panel-preview") {
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
          <JiraPanelApp />
          <ToastContainer />
        </div>
      );
    }
    return (
      <>
        <JiraPanelApp />
        <ToastContainer />
      </>
    );
  }

  return (
    <TourProvider>
      <App />
    </TourProvider>
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
