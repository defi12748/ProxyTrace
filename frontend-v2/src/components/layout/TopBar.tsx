import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, Bell, ExternalLink, Menu, Search, X } from "lucide-react";
import { SearchBar } from "../ui/SearchBar";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/traces": "Traces",
  "/drift": "Drift",
  "/regression": "Regression",
};

const MOBILE_NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/traces", label: "Traces" },
  { to: "/drift", label: "Drift" },
  { to: "/regression", label: "Tests" },
];

function getPageLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith("/traces/") && pathname.endsWith("/replay")) return "Replay Studio";
  if (pathname.startsWith("/traces/")) return "Trace Detail";
  return "ProxyTrace";
}

interface TopBarProps {
  onSearch?: (q: string) => void;
  isMobile?: boolean;
  onToggleSidebar?: () => void;
}

export function TopBar({ onSearch, isMobile = false, onToggleSidebar }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pageLabel = getPageLabel(location.pathname);

  useEffect(() => {
    if (location.pathname === "/traces") {
      setSearch(new URLSearchParams(location.search).get("search") ?? "");
    }
    setNotifOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (mobileSearchOpen) mobileInputRef.current?.focus();
  }, [mobileSearchOpen]);

  function handleSearch(value: string) {
    setSearch(value);
    onSearch?.(value);
    if (!value.trim() && location.pathname === "/traces" && location.search) {
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
    <header className={isMobile ? "topbar topbar--mobile" : "topbar"}>
      <div className="topbar__main">
        <div className="topbar__identity">
          {isMobile && onToggleSidebar && (
            <button
              type="button"
              className="topbar__icon-button"
              aria-label="Open navigation menu"
              aria-haspopup="dialog"
              onClick={onToggleSidebar}
            >
              <Menu size={19} />
            </button>
          )}

          {isMobile ? (
            <NavLink to="/" className="topbar__brand" aria-label="ProxyTrace dashboard">
              <span className="topbar__brand-mark"><Activity size={15} /></span>
              <span className="topbar__brand-name">ProxyTrace</span>
            </NavLink>
          ) : (
            <span className="topbar__page-label">{pageLabel}</span>
          )}

          {isMobile && <span className="topbar__mobile-page">{pageLabel}</span>}
        </div>

        <div className="topbar__actions">
          {isMobile ? (
            <button
              type="button"
              className="topbar__icon-button"
              aria-label={mobileSearchOpen ? "Close search" : "Search traces"}
              aria-expanded={mobileSearchOpen}
              onClick={() => setMobileSearchOpen((open) => !open)}
            >
              {mobileSearchOpen ? <X size={17} /> : <Search size={17} />}
            </button>
          ) : (
            <SearchBar
              value={search}
              onChange={handleSearch}
              onSubmit={submitSearch}
              placeholder="Search issue, run ID, or status…"
            />
          )}

          <div className="topbar__notification">
            <button
              type="button"
              className={isMobile ? "topbar__icon-button" : "topbar__text-button"}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((open) => !open)}
            >
              <Bell size={16} />
              {!isMobile && <span>Notifications</span>}
            </button>

            {notifOpen && (
              <div className="topbar__notification-panel">
                <div className="topbar__notification-title">Notifications</div>
                <div className="topbar__notification-empty">
                  <Bell size={26} />
                  <span>No new notifications</span>
                </div>
              </div>
            )}
          </div>

          {!isMobile && (
            <>
              <span className="topbar__divider" />
              <a
                className="topbar__docs-link"
                href="https://proxytrace.onrender.com/docs"
                target="_blank"
                rel="noreferrer"
              >
                <span>API Docs</span>
                <ExternalLink size={12} />
              </a>
            </>
          )}
        </div>
      </div>

      {isMobile && mobileSearchOpen && (
        <form
          className="topbar__mobile-search"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch(search);
          }}
        >
          <Search size={16} />
          <input
            ref={mobileInputRef}
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Search issue, run ID, or status…"
            aria-label="Search traces"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => handleSearch("")}>
              <X size={14} />
            </button>
          )}
        </form>
      )}

      {isMobile && (
        <nav className="topbar__mobile-nav" aria-label="Primary navigation">
          {MOBILE_NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => isActive ? "active" : undefined}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
