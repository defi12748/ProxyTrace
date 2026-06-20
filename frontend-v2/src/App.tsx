import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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

function GlobalTourTracker() {
  const { hasSeen, startTour } = useTour();

  useEffect(() => {
    // Only run on the dashboard route
    if (window.location.pathname !== "/") return;

    if (!hasSeen("welcome-tour")) {
      // Delay slightly so the page renders fully
      setTimeout(() => {
        startTour({
          id: "welcome-tour",
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
      }, 800);
    }
  }, [hasSeen, startTour]);

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
