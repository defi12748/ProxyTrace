/* ============================================================
   ProxyTrace — Tour System
   Lightweight coach-mark / spotlight tour using localStorage.
   No external dependencies.
   ============================================================ */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TourStep {
  /** CSS selector or element id (without #) to spotlight */
  target: string;
  /** Heading shown in the tooltip */
  title: string;
  /** Body text */
  description: string;
  /** Where the tooltip pops relative to the target */
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

export interface TourDefinition {
  id: string;
  steps: TourStep[];
}

interface TourContextValue {
  startTour: (tour: TourDefinition) => void;
  resetAll: () => void;
  hasSeen: (id: string) => boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TourContext = createContext<TourContextValue>({
  startTour: () => undefined,
  resetAll: () => undefined,
  hasSeen: () => true,
});

export function useTour() {
  return useContext(TourContext);
}

const STORAGE_KEY = "proxytrace_tours_seen";

function getSeenSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const s = getSeenSet();
    s.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {
    // ignore
  }
}

// ─── Tooltip position calculator ──────────────────────────────────────────────

function calcTooltipPosition(
  rect: DOMRect,
  placement: TourStep["placement"],
  tooltipW: number,
  tooltipH: number
): { top: number; left: number } {
  const GAP = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (placement === "center") {
    return {
      top: vh / 2 - tooltipH / 2,
      left: vw / 2 - tooltipW / 2,
    };
  }

  let top = 0;
  let left = 0;

  switch (placement) {
    case "top":
      top = rect.top - tooltipH - GAP;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - tooltipW - GAP;
      break;
    case "right":
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.right + GAP;
      break;
    case "bottom":
    default:
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
  }

  // Clamp within viewport
  left = Math.max(12, Math.min(left, vw - tooltipW - 12));
  top = Math.max(12, Math.min(top, vh - tooltipH - 12));
  return { top, left };
}

// ─── Overlay component ────────────────────────────────────────────────────────

const TOOLTIP_W = 330;

function TourOverlay({
  tour,
  stepIdx,
  onNext,
  onSkip,
}: {
  tour: TourDefinition;
  stepIdx: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const step = tour.steps[stepIdx];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipH, setTooltipH] = useState(180);

  // Find and measure the target element
  useEffect(() => {
    const findRect = () => {
      const el =
        document.getElementById(step.target) ??
        document.querySelector(step.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        setTargetRect(null);
      }
    };

    findRect();
    const t1 = setTimeout(findRect, 100);
    const t2 = setTimeout(findRect, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [step.target]);

  // Measure tooltip height after render
  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipH(tooltipRef.current.offsetHeight);
    }
  });

  const isLast = stepIdx === tour.steps.length - 1;
  const placement = step.placement ?? "bottom";

  const PAD = 8;
  const spotlight = targetRect
    ? {
        top: targetRect.top - PAD,
        left: targetRect.left - PAD,
        width: targetRect.width + PAD * 2,
        height: targetRect.height + PAD * 2,
      }
    : null;

  const tooltipPos =
    targetRect && placement !== "center"
      ? calcTooltipPosition(targetRect, placement, TOOLTIP_W, tooltipH)
      : calcTooltipPosition(
          new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0),
          "center",
          TOOLTIP_W,
          tooltipH
        );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99000, pointerEvents: "none" }}>
      {/* Dark overlay with spotlight cutout */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "all" }}
        onClick={onSkip}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(10,8,20,0.75)" mask="url(#tour-mask)" />
      </svg>

      {/* Spotlight border glow */}
      {spotlight && (
        <div
          style={{
            position: "absolute",
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: "10px",
            border: "1.5px solid rgba(167,139,250,0.85)",
            boxShadow: "0 0 0 3px rgba(167,139,250,0.1), 0 0 32px rgba(167,139,250,0.2)",
            pointerEvents: "none",
            animation: "pulseBorder 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Tooltip card — original light design */}
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_W,
          background: "#FFFFFF",
          borderRadius: "14px",
          border: "1px solid rgba(184,130,254,0.35)",
          boxShadow:
            "0 8px 32px rgba(30,27,38,0.18), 0 0 0 1px rgba(184,130,254,0.12)",
          pointerEvents: "all",
          animation: "scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
        }}
      >
        {/* Gradient accent bar */}
        <div style={{ height: "2px", background: "linear-gradient(90deg, #7C3AED 0%, #a78bfa 60%, transparent 100%)" }} />

        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #F2E8FF 0%, #E0D0FF 100%)",
            padding: "14px 18px 12px",
            borderBottom: "1px solid rgba(184,130,254,0.2)",
          }}
        >
          {/* Step counter pill */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "2px 10px",
            borderRadius: "99px",
            background: "rgba(124,58,237,0.12)",
            border: "1px solid rgba(124,58,237,0.25)",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.07em",
            color: "#7C3AED",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>
            <span style={{ display: "inline-block", width: "4px", height: "4px", borderRadius: "50%", background: "#7C3AED" }} />
            Step {stepIdx + 1} of {tour.steps.length}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 700,
              color: "#350566",
              lineHeight: 1.25,
            }}
          >
            {step.title}
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 18px 16px" }}>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "13px",
              color: "#626073",
              lineHeight: 1.65,
            }}
          >
            {step.description}
          </p>

          {/* Progress segments */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
            {tour.steps.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: i === stepIdx ? 2.5 : 1,
                  height: "4px",
                  borderRadius: "99px",
                  background: i < stepIdx
                    ? "#B882FE"
                    : i === stepIdx
                    ? "#B882FE"
                    : "#DEE0E7",
                  opacity: i < stepIdx ? 0.5 : 1,
                  transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onNext}
              style={{
                flex: 1,
                padding: "9px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#B882FE",
                color: "#350566",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#D3B3FF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#B882FE"; }}
            >
              {isLast ? "Done" : "Next →"}
            </button>
            <button
              onClick={onSkip}
              style={{
                padding: "9px 14px",
                borderRadius: "8px",
                border: "1px solid #DEE0E7",
                background: "transparent",
                color: "#A09FB5",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#F5F6F8";
                e.currentTarget.style.color = "#626073";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#A09FB5";
              }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  const hasSeen = useCallback((id: string) => getSeenSet().has(id), []);

  const startTour = useCallback((tour: TourDefinition) => {
    setActiveTour(tour);
    setStepIdx(0);
  }, []);

  const endTour = useCallback(() => {
    if (activeTour) markSeen(activeTour.id);
    setActiveTour(null);
    setStepIdx(0);
  }, [activeTour]);

  const onNext = useCallback(() => {
    if (!activeTour) return;
    if (stepIdx < activeTour.steps.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      endTour();
    }
  }, [activeTour, stepIdx, endTour]);

  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Keyboard nav
  useEffect(() => {
    if (!activeTour) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
      if (e.key === "ArrowRight" || e.key === "Enter") onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTour, endTour, onNext]);

  const value = useMemo(
    () => ({ startTour, resetAll, hasSeen }),
    [startTour, resetAll, hasSeen]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && (
        <TourOverlay
          tour={activeTour}
          stepIdx={stepIdx}
          onNext={onNext}
          onSkip={endTour}
        />
      )}
    </TourContext.Provider>
  );
}
