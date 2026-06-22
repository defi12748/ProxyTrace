import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SearchBar } from "../ui/SearchBar";
import { Bell, ExternalLink } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "/":           "Dashboard",
  "/traces":     "Traces",
  "/drift":      "Drift",
  "/regression": "Regression",
};

function getPageLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith("/traces/") && pathname.endsWith("/replay")) return "Replay Studio";
  if (pathname.startsWith("/traces/")) return "Trace Detail";
  return "ProxyTrace";
}

interface TopBarProps {
  onSearch?: (q: string) => void;
}

/* Matches dotrack Header.js: bg-[#F5F6F8] border-b border-[#DEE0E7], search + notification + contact */
export function TopBar({ onSearch }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const pageLabel = getPageLabel(location.pathname);

  useEffect(() => {
    if (location.pathname === "/traces") {
      setSearch(new URLSearchParams(location.search).get("search") ?? "");
    }
  }, [location.pathname, location.search]);

  function handleSearch(v: string) {
    setSearch(v);
    onSearch?.(v);
    if (!v.trim() && location.pathname === "/traces" && location.search) {
      navigate("/traces");
    }
  }

  function submitSearch(value: string) {
    const query = value.trim();
    if (!query) return;
    onSearch?.(query);
    navigate(`/traces?search=${encodeURIComponent(query)}`);
  }

  return (
    <header
      style={{
        height: "50px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: current page breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
          {pageLabel}
        </span>
      </div>

      {/* Right: search + notifications + contact */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>

        {/* Animated search bar — matches dotrack SearchBar */}
        <SearchBar
          value={search}
          onChange={handleSearch}
          onSubmit={submitSearch}
          placeholder="Search issue, run ID, or status…"
        />

        {/* Notification bell — matches dotrack notification button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: "12px",
              fontWeight: 600,
              transition: "background var(--transition)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-raised)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Bell size={15} />
            <span>Notifications</span>
          </button>

          {/* Notification panel */}
          {notifOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 100,
                width: "300px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-xl)",
                boxShadow: "0px 0px 12px 0px rgba(179,180,198,0.40)",
                overflow: "hidden",
                animation: "fadeIn 150ms ease",
              }}
            >
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Notifications</h3>
              </div>
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <Bell size={28} style={{ color: "var(--border-strong)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No new notifications</p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: "1px", height: "20px", background: "var(--border)" }} />

        {/* Contact / docs link — matches dotrack Contact button */}
        <a
          href="https://proxytrace.onrender.com/docs"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 10px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--text-secondary)",
            background: "var(--bg-base)",
            color: "var(--text-secondary)",
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "none",
            transition: "all var(--transition)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.borderColor = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.borderColor = "var(--text-secondary)";
          }}
        >
          <span>API Docs</span>
          <ExternalLink size={11} />
        </a>
      </div>
    </header>
  );
}
