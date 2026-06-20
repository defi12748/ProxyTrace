/* ======================================================
   Charts powered by Recharts
   Matches dotrack's minimalist chart aesthetics
   ====================================================== */
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell, XAxis, PieChart, Pie } from 'recharts';

interface SparkBarProps {
  data: { label: string; value: number; hasDrift?: boolean }[];
  height?: number | string;
  color?: string;
  driftColor?: string;
}

/** 7-day activity bar chart — green bars, amber when drift detected */
export function SparkBar({ data, height = 64, color = "var(--blue)", driftColor = "var(--amber)" }: SparkBarProps) {
  const chartData = data.map(d => ({
    ...d,
    shortLabel: d.label.split(',')[0],
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <XAxis 
            dataKey="shortLabel" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }} 
            dy={8} 
            height={24} 
          />
          <Tooltip 
            cursor={{ fill: 'var(--bg-raised)', radius: 4 }}
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', fontSize: '13px', padding: '10px 14px' }}
            itemStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
            labelStyle={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
            formatter={(value: any, _name: any, props: any) => [
              `${value} run${value !== 1 ? 's' : ''}${props.payload.hasDrift ? ' (Drift Detected)' : ''}`, 
              'Count'
            ]}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} animationDuration={1000} animationEasing="ease-out">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.hasDrift ? driftColor : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
  const outerRadius = size / 2;
  const innerRadius = outerRadius - thickness;

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            animationDuration={1000}
            animationEasing="ease-out"
          >
            {segments.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            cursor={{ fill: 'var(--bg-raised)' }}
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', fontSize: '13px', padding: '8px 12px' }}
            itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
            formatter={(value: any) => [value, 'Runs']}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
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
