/* ======================================================
   Pure SVG charts — no third-party library needed
   Matches dotrack's minimalist chart aesthetics
   ====================================================== */

interface SparkBarProps {
  data: { label: string; value: number; hasDrift?: boolean }[];
  height?: number;
  color?: string;
  driftColor?: string;
}

/** 7-day activity bar chart — green bars, amber when drift detected */
export function SparkBar({ data, height = 64, color = "var(--blue)", driftColor = "var(--amber)" }: SparkBarProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height, width: "100%", gap: "6px" }}>
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * 100, d.value > 0 ? 12 : 4);
        const fill = d.hasDrift ? driftColor : color;
        return (
          <div key={i} style={{ flex: 1, maxWidth: "24px", height: "100%", display: "flex", alignItems: "flex-end" }}>
            <div
              title={`${d.label}: ${d.value} run${d.value !== 1 ? "s" : ""}${d.hasDrift ? " · drift" : ""}`}
              style={{
                width: "100%",
                height: `${barH}%`,
                background: d.value > 0 ? fill : "var(--border)",
                borderRadius: "4px",
                transition: "height 0.6s ease",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

interface DonutProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}

/** Status donut chart — completed / failed / running breakdown */
export function DonutChart({ segments, size = 96, thickness = 14 }: DonutProps) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
      </svg>
    );
  }

  let offset = 0;
  // Start from top (-90deg = -circumference/4 offset)
  const startOffset = circumference / 4;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      {/* Background track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        if (seg.value === 0) return null;
        const portion = seg.value / total;
        const dash = portion * circumference;
        const segOffset = startOffset - offset;
        offset += dash;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={segOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          >
            <title>{seg.label}: {seg.value}</title>
          </circle>
        );
      })}
    </svg>
  );
}

interface AreaChartProps {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
}

/** Drift-over-time area chart */
export function AreaChart({ data, width = 300, height = 80, color = "var(--amber)" }: AreaChartProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const padX = 4;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = innerW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padX + i * step,
    y: padY + innerH - (d.value / max) * innerH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padY + innerH} L${points[0].x},${padY + innerH} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#area-grad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color}>
          <title>{data[i].label}: {data[i].value}</title>
        </circle>
      ))}
    </svg>
  );
}
