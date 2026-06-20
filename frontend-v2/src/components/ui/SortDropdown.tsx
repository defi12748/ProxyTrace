import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface SortOption {
  id: string;
  label: string;
  description?: string;
}

interface SortDropdownProps {
  options: SortOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
}

/* Matches dotrack SortByButton.js: dropdown with radio-style purple selection */
export function SortDropdown({ options, value, onChange, label = "Sort by" }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const active = value !== null;

  return (
    <div style={{ position: "relative" }} ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); setPending(value); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "7px 10px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${open || active ? "var(--border-strong)" : "var(--border)"}`,
          background: "var(--bg-base)",
          color: open || active ? "var(--text-secondary)" : "var(--text-muted)",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all var(--transition)",
        }}
      >
        <span>{label}</span>
        <ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {/* Dropdown panel — matches dotrack sort dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 100,
            width: "240px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "0px 0px 8px 0px rgba(179,180,198,0.50)",
            overflow: "hidden",
            animation: "fadeIn 150ms ease",
          }}
        >
          {/* Options */}
          <div style={{ padding: "12px" }}>
            {options.map((opt, i) => (
              <div key={opt.id}>
                <div
                  onClick={() => setPending(opt.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "8px 4px",
                    cursor: "pointer",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {/* Radio dot — purple when selected */}
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      border: `1px solid ${pending === opt.id ? "var(--purple)" : "var(--border)"}`,
                      background: pending === opt.id ? "var(--purple)" : "var(--bg-base)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {pending === opt.id && <Check size={9} style={{ color: "white", strokeWidth: 3 }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>{opt.label}</div>
                    {opt.description && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{opt.description}</div>
                    )}
                  </div>
                </div>
                {i < options.length - 1 && <hr style={{ borderColor: "var(--border)" }} />}
              </div>
            ))}
          </div>

          {/* Footer actions — matches dotrack cancel/apply */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-surface)",
            }}
          >
            <button
              onClick={() => { onChange(null); setPending(null); setOpen(false); }}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--purple-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Cancel
            </button>
            <button
              onClick={() => { onChange(pending); setOpen(false); }}
              disabled={!pending}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: pending ? "var(--purple)" : "var(--purple-dim)",
                color: pending ? "var(--purple-text)" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: pending ? "pointer" : "not-allowed",
                transition: "background var(--transition)",
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
