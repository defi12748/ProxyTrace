import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

const toastStyles: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: "var(--green-dim)",  border: "#86efac", color: "var(--green-text)" },
  error:   { bg: "var(--rose-dim)",   border: "#fca5a5", color: "var(--rose-text)" },
  warning: { bg: "var(--amber-dim)",  border: "#fcd34d", color: "var(--amber-text)" },
  info:    { bg: "var(--blue-dim)",   border: "#93c5fd", color: "var(--blue-text)" },
};

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

// Inject keyframes once
function injectStyles() {
  if (document.getElementById("toast-styles")) return;
  const style = document.createElement("style");
  style.id = "toast-styles";
  style.textContent = `
    @keyframes toast-in  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes toast-out { from { opacity: 1; transform: translateY(0); }  to { opacity: 0; transform: translateY(8px); } }
  `;
  document.head.appendChild(style);
}

function ToastItem({
  message,
  type = "info",
  duration,
  onDone,
}: {
  message: string;
  type?: ToastType;
  duration: number;
  onDone: () => void;
}) {
  const { bg, border, color } = toastStyles[type];
  const Icon = ICONS[type];
  const [exiting, setExiting] = useState(false);

  // Start exit animation before unmounting
  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onDone, 200); // match animation duration
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer); // cleanup if unmounted early
  }, [duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onClick={dismiss}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        maxWidth: "380px",
        cursor: "pointer",
        animation: exiting
          ? "toast-out 200ms ease forwards"
          : "toast-in 200ms ease forwards",
      }}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>
        {message}
      </span>
      <X
        size={14}
        style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: 4 }}
        aria-label="Dismiss"
      />
    </div>
  );
}

/* ── Imperative container ── */
let _container: HTMLElement | null = null;

function getContainer() {
  if (!_container) {
    injectStyles();
    _container = document.createElement("div");
    Object.assign(_container.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "9999",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      // Mobile: full-width centered at bottom
      left: "auto",
    });
    // Responsive: stack from bottom-center on mobile
    const mq = window.matchMedia("(max-width: 480px)");
    const applyMq = (e: MediaQueryList | MediaQueryListEvent) => {
      if (!_container) return;
      if (e.matches) {
        Object.assign(_container.style, { right: "12px", left: "12px", bottom: "16px" });
      } else {
        Object.assign(_container.style, { right: "24px", left: "auto", bottom: "24px" });
      }
    };
    applyMq(mq);
    mq.addEventListener("change", applyMq);
    document.body.appendChild(_container);
  }
  return _container;
}

export function showToast(message: string, type: ToastType = "info", duration = 3500) {
  const container = getContainer();
  const slot = document.createElement("div");
  container.appendChild(slot);
  const root = createRoot(slot);

  const cleanup = () => {
    root.unmount();
    slot.remove();
  };

  root.render(
    <ToastItem message={message} type={type} duration={duration} onDone={cleanup} />
  );
}

/* Convenience no-op for App.tsx import parity */
export function ToastContainer() {
  return null;
}