import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  GitBranch,
  LayoutDashboard,
  List,
  ShieldAlert,
  TestTube2,
} from "lucide-react";

const NAV = [
  { to: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { to: "/traces",     label: "Traces",     icon: List },
  { to: "/drift",      label: "Drift",      icon: ShieldAlert },
  { to: "/regression", label: "Regression", icon: TestTube2 },
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: "var(--sidebar-width)",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
        userSelect: "none",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 18px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--cyan), var(--violet))",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Activity size={17} color="white" />
        </div>
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            ProxyTrace
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Agent Observability
          </div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: "18px 18px 6px" }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text-muted)",
          }}
        >
          Navigation
        </span>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "0 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {NAV.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 10px",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 500,
                textDecoration: "none",
                transition: "all var(--transition)",
                color: isActive ? "var(--cyan)" : "var(--text-secondary)",
                background: isActive ? "var(--cyan-dim)" : "transparent",
                border: isActive
                  ? "1px solid rgba(99,179,237,0.15)"
                  : "1px solid transparent",
              }}
            >
              <Icon size={15} />
              {label}
              {isActive && (
                <span
                  style={{
                    marginLeft: "auto",
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "var(--cyan)",
                  }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "14px 18px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <GitBranch size={13} style={{ color: "var(--text-muted)" }} />
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          v0.2 · Render backend
        </span>
      </div>
    </aside>
  );
}
