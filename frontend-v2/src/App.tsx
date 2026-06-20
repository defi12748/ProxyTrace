import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { ToastContainer } from "./components/ui/Toast";
import { DashboardPage } from "./pages/DashboardPage";
import { TracesPage } from "./pages/TracesPage";
import { TraceDetailPage } from "./pages/TraceDetailPage";
import { ReplayStudioPage } from "./pages/ReplayStudioPage";
import { DriftPage } from "./pages/DriftPage";
import { RegressionPage } from "./pages/RegressionPage";

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

      <ToastContainer />
    </BrowserRouter>
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
