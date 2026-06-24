import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  ShieldAlert,
  TestTube2,
  ChevronLeft,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard",   to: "/",            label: "Dashboard",   Icon: LayoutDashboard },
  { id: "traces",      to: "/traces",      label: "Traces",      Icon: GitBranch },
  { id: "drift",       to: "/drift",       label: "Drift",       Icon: ShieldAlert },
  { id: "regression",  to: "/regression",  label: "Regression",  Icon: TestTube2 },
];

interface SidebarProps {
  isMobile?: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, mobileOpen = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

  const isCollapsed = !isMobile && collapsed && !hovering;

  const sidebar = (
    <div
      id="tour-sidebar"
      onMouseEnter={() => { if (!isMobile && collapsed) setHovering(true); }}
      onMouseLeave={() => { if (!isMobile && collapsed) setHovering(false); }}
      style={{
        width: isMobile
          ? "min(84vw, 320px)"
          : isCollapsed
            ? "var(--sidebar-collapsed-width)"
            : "var(--sidebar-width)",
        minWidth: isMobile
          ? "min(84vw, 320px)"
          : isCollapsed
            ? "var(--sidebar-collapsed-width)"
            : "var(--sidebar-width)",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
        borderRight: "1px solid var(--border)",
        transition: isMobile
          ? "transform var(--transition-slow), box-shadow var(--transition-slow)"
          : "width var(--transition-slow), min-width var(--transition-slow)",
        overflow: "hidden",
        flexShrink: 0,
        position: isMobile ? "fixed" : "relative",
        top: isMobile ? 0 : undefined,
        left: isMobile ? 0 : undefined,
        bottom: isMobile ? 0 : undefined,
        zIndex: isMobile ? 120 : "auto",
        transform: isMobile ? (mobileOpen ? "translateX(0)" : "translateX(-100%)") : "none",
        boxShadow: isMobile && mobileOpen ? "var(--shadow-lg)" : "none",
      }}
    >
      {/* ── Logo header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          padding: "12px",
          borderBottom: "1px solid var(--border)",
          height: "50px",
          flexShrink: 0,
        }}
      >
        {/* Logo mark + title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            overflow: "hidden",
            cursor: isCollapsed ? "pointer" : "default",
            flexShrink: 0,
          }}
          onClick={() => {
            if (!isMobile && isCollapsed) {
              setCollapsed(false);
              setHovering(false);
            }
          }}
          title={isCollapsed ? "Expand sidebar" : undefined}
        >
          {/* Logo image — always visible */}
          <img
             onClick={() => setCollapsed(!collapsed)}
            src="./logo.png"
            alt="ProxyTrace logo"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "var(--radius-md)",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />

          {/* Title image — hidden when collapsed */}
          {!isCollapsed && (
            <img
              src="./title.png"
              alt="ProxyTrace"
              style={{
                height: "22px",
                objectFit: "contain",
                animation: "slideIn 0.2s ease",
                whiteSpace: "nowrap",
              } as React.CSSProperties}
            />
          )}
        </div>

        {/* Collapse / close button — only shown when expanded */}
        {!isCollapsed && (
          isMobile ? (
            <button
              onClick={onClose}
              aria-label="Close navigation menu"
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
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Collapse sidebar"
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
          )
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
            onClick={() => { if (isMobile) onClose?.(); }}
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
                  if (!isActive && !isMobile) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.6)";
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isMobile) {
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

  return (
    <>
      {sidebar}
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(48, 47, 55, 0.28)",
            border: "none",
            zIndex: 110,
            cursor: "pointer",
          }}
        />
      )}
    </>
  );
}
