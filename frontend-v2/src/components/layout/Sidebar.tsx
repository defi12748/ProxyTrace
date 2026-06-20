import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  ShieldAlert,
  TestTube2,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard",   to: "/",            label: "Dashboard",   Icon: LayoutDashboard },
  { id: "traces",      to: "/traces",      label: "Traces",      Icon: GitBranch },
  { id: "drift",       to: "/drift",       label: "Drift",       Icon: ShieldAlert },
  { id: "regression",  to: "/regression",  label: "Regression",  Icon: TestTube2 },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Expand on hover when collapsed (dotrack behaviour)
  const isCollapsed = collapsed && !hovering;

  return (
    <div
      id="tour-sidebar"
      onMouseEnter={() => { if (collapsed) setHovering(true); }}
      onMouseLeave={() => { if (collapsed) setHovering(false); }}
      style={{
        width: isCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
        minWidth: isCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
        borderRight: "1px solid var(--border)",
        transition: "width var(--transition-slow), min-width var(--transition-slow)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* ── Logo header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px",
          borderBottom: "1px solid var(--border)",
          height: "50px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
          {/* Icon mark */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-md)",
              background: "var(--purple)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Activity size={16} style={{ color: "white" }} />
          </div>
          {/* Full name — hidden when collapsed */}
          {!isCollapsed && (
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                animation: "slideIn 0.2s ease",
              }}
            >
              ProxyTrace
            </span>
          )}
        </div>

        {/* Toggle button — only visible when not collapsed */}
        {!isCollapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: "30px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "background var(--transition)",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-raised)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* When collapsed, show expand icon */}
        {isCollapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{
              width: "30px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* ── Main navigation ── */}
      <nav
        style={{
          flex: 1,
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          overflowY: "auto",
        }}
      >
        {NAV_ITEMS.map(({ id, to, label, Icon }) => (
          <NavLink
            key={id}
            to={to}
            end={to === "/"}
            style={{ textDecoration: "none" }}
          >
            {({ isActive }) => (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: isCollapsed ? "8px" : "8px 12px",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  borderRadius: "var(--radius-md)",
                  border: isActive
                    ? "1px solid var(--border-strong)"
                    : "1px solid transparent",
                  background: isActive ? "var(--bg-surface)" : "transparent",
                  color: isActive ? "var(--purple-text)" : "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all var(--transition)",
                  whiteSpace: "nowrap",
                  marginTop: "2px",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.6)";
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }
                }}
              >
                <Icon
                  size={18}
                  style={{
                    color: isActive ? "var(--purple-text)" : "var(--text-secondary)",
                    flexShrink: 0,
                  }}
                />
                {!isCollapsed && <span>{label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "10px 12px",
          fontSize: "11px",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--green)",
            flexShrink: 0,
            animation: "pulseDot 2s ease-in-out infinite",
          }}
        />
        {!isCollapsed && <span>v0.2 · Render backend</span>}
      </div>
    </div>
  );
}
