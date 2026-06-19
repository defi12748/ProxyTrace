import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

let _setToast: ((t: ToastItem | null) => void) | null = null;
let _counter = 0;

export function showToast(message: string, kind: ToastKind = "info") {
  _setToast?.({ id: ++_counter, message, kind });
}

const kindColor: Record<ToastKind, string> = {
  success: "var(--emerald)",
  error:   "var(--rose)",
  info:    "var(--cyan)",
};

const kindBg: Record<ToastKind, string> = {
  success: "rgba(52,211,153,0.1)",
  error:   "rgba(248,113,113,0.1)",
  info:    "rgba(99,179,237,0.1)",
};

const kindIcon: Record<ToastKind, typeof CheckCircle> = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
};

export function ToastContainer() {
  const [toast, setToast] = useState<ToastItem | null>(null);

  useEffect(() => {
    _setToast = setToast;
    return () => { _setToast = null; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const Icon = kindIcon[toast.kind];
  const color = kindColor[toast.kind];
  const bg = kindBg[toast.kind];

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        animation: "toastSlideIn 200ms ease forwards",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 16px",
          background: bg,
          border: `1px solid ${color}44`,
          borderRadius: "var(--radius-lg)",
          boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}22`,
          backdropFilter: "blur(12px)",
          maxWidth: "380px",
        }}
      >
        <Icon size={16} style={{ color, flexShrink: 0 }} />
        <span style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.4 }}>
          {toast.message}
        </span>
      </div>
    </div>
  );
}
