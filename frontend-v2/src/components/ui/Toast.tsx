import { createRoot } from "react-dom/client";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

const toastStyles: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: "var(--green-dim)",  border: "#86efac", color: "var(--green-text)" },
  error:   { bg: "var(--rose-dim)",   border: "#fca5a5", color: "var(--rose-text)" },
  warning: { bg: "var(--amber-dim)",  border: "#fcd34d", color: "var(--amber-text)" },
  info:    { bg: "var(--blue-dim)",   border: "#93c5fd", color: "var(--blue-text)" },
};

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

function ToastItem({ message, type = "info" }: { message: string; type?: ToastType }) {
  const { bg, border, color } = toastStyles[type];
  const Icon = ICONS[type];

  return (
    <div
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
        animation: "slideIn 200ms ease forwards",
      }}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>
        {message}
      </span>
    </div>
  );
}

/* Container rendered at app root */
let _container: HTMLElement | null = null;
function getContainer() {
  if (!_container) {
    _container = document.createElement("div");
    Object.assign(_container.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "9999",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });
    document.body.appendChild(_container);
  }
  return _container;
}

export function showToast(message: string, type: ToastType = "info", duration = 3500) {
  const container = getContainer();
  const slot = document.createElement("div");
  container.appendChild(slot);
  const root = createRoot(slot);
  root.render(<ToastItem message={message} type={type} />);
  setTimeout(() => {
    root.unmount();
    slot.remove();
  }, duration);
}

/* Convenience wrapper for App.tsx */
export function ToastContainer() {
  return null; // container is managed imperatively above
}
