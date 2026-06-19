import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
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
      <div className="app-layout">
        <Sidebar />
        <main className="app-content">
          <div className="page-body">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/traces" element={<TracesPage />} />
              <Route path="/traces/:runId" element={<TraceDetailPage />} />
              <Route path="/traces/:runId/replay" element={<ReplayStudioPage />} />
              <Route path="/drift" element={<DriftPage />} />
              <Route path="/regression" element={<RegressionPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
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
      <span style={{ fontSize: "48px", fontWeight: 800, color: "var(--text-muted)" }}>404</span>
      <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
        Page not found.{" "}
        <a href="/" style={{ color: "var(--cyan)" }}>
          Go to dashboard
        </a>
      </p>
    </div>
  );
}
