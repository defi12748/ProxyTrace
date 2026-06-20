interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface StatusTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (value: string) => void;
}

/**
 * Pill-style filter tabs — matches dotrack's status filter tab UI.
 * Active tab: purple background (#e6d4ff border, #350566 text).
 * Inactive: #F5F6F8 bg, #DEE0E7 border, #B3B4C6 text.
 */
export function StatusTabs({ tabs, active, onChange }: StatusTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 12px",
              height: "30px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${isActive ? "var(--purple)" : "var(--border)"}`,
              background: isActive ? "var(--purple-dim)" : "var(--bg-base)",
              color: isActive ? "var(--purple-text)" : "var(--text-muted)",
              fontSize: "12px",
              fontWeight: isActive ? 700 : 500,
              cursor: "pointer",
              transition: "all var(--transition)",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-muted)";
              }
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 5px",
                  borderRadius: "99px",
                  fontSize: "10px",
                  fontWeight: 700,
                  background: isActive ? "var(--purple)" : "var(--border)",
                  color: isActive ? "white" : "var(--text-muted)",
                  transition: "all var(--transition)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
