import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutDashboard, Database, ShieldAlert, TestTube2, ArrowRight } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const routes = [
    { name: "Dashboard", path: "/", icon: <LayoutDashboard size={14} /> },
    { name: "Traces", path: "/traces", icon: <Database size={14} /> },
    { name: "Drift Warnings", path: "/drift", icon: <ShieldAlert size={14} /> },
    { name: "Regression Suite", path: "/regression", icon: <TestTube2 size={14} /> },
  ];

  const q = search.toLowerCase();
  const filteredRoutes = routes.filter((r) => r.name.toLowerCase().includes(q));
  const isUuidLike = search.length > 8 && search.includes("-");

  const navigateTo = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        animation: "fadeIn 150ms ease forwards",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "16px", borderBottom: "1px solid var(--border)" }}>
          <Search size={18} style={{ color: "var(--text-muted)", marginRight: "12px" }} />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages or paste a Trace ID..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "16px",
              fontFamily: "var(--font-ui)",
            }}
          />
          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", background: "var(--bg-base)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--border)" }}>
            ESC
          </div>
        </div>

        <div style={{ padding: "8px", maxHeight: "300px", overflowY: "auto" }}>
          {isUuidLike && (
            <button
              onClick={() => navigateTo(`/traces/${search}`)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--text-primary)",
                transition: "background 0.1s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-raised)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <ArrowRight size={14} style={{ color: "var(--purple-text)" }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500 }}>Jump to Trace</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{search}</div>
              </div>
            </button>
          )}

          {filteredRoutes.length > 0 && (
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", padding: "8px 16px 4px" }}>
              Navigation
            </div>
          )}

          {filteredRoutes.map((route) => (
            <button
              key={route.path}
              onClick={() => navigateTo(route.path)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--text-secondary)",
                transition: "all 0.1s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-raised)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <div style={{ color: "var(--text-muted)" }}>{route.icon}</div>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>{route.name}</span>
            </button>
          ))}

          {filteredRoutes.length === 0 && !isUuidLike && (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No results found for "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
