import { useId } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { shortDate } from '@/lib/dates'

const AXIS = '#8a8f98'
const GRID = 'rgba(255,255,255,0.07)'

const tooltipStyle = {
  background: 'rgba(20,22,27,0.92)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontSize: 12,
  padding: '6px 10px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
} as const

interface LineTrendProps {
  /** Unlogged days may be null — the line breaks instead of dipping to 0. */
  data: { date: string; value: number | null }[]
  color: string
  unit?: string
  /** Optional target line. */
  target?: number
  height?: number
  /**
   * Time-scale the x-axis so gaps occupy their real width — a 30-day logging
   * gap must not look like one day. Use for sparse all-time series (weight,
   * portfolio, mocks); leave off for dense fixed-window series.
   */
  time?: boolean
}

/** Smooth area trend with a soft gradient fill and glow dot — the signature chart. */
export function LineTrend({ data, color, unit = '', target, height = 160, time }: LineTrendProps) {
  const gradId = useId()
  const logged = data.filter((d) => d.value != null)
  if (logged.length === 0) {
    return <EmptyChart height={height} />
  }
  const values = logged.map((d) => d.value as number)
  if (target != null) values.push(target)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min || 1) * 0.15

  const points = time
    ? data.map((d) => ({ ...d, x: Date.parse(`${d.date}T00:00:00`) }))
    : data

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 6, right: 10, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {time ? (
          <XAxis
            dataKey="x"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts: number) => shortDate(new Date(ts).toISOString().slice(0, 10))}
            tick={{ fill: AXIS, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={28}
          />
        ) : (
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: AXIS, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={28}
          />
        )}
        <YAxis
          domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
          tick={{ fill: AXIS, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={34}
        />
        {target != null && (
          <ReferenceLine
            y={target}
            stroke={color}
            strokeDasharray="4 4"
            strokeOpacity={0.45}
            label={{ value: `${target}${unit}`, fill: AXIS, fontSize: 10, position: 'insideTopRight' }}
          />
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(l) =>
            time ? shortDate(new Date(Number(l)).toISOString().slice(0, 10)) : shortDate(String(l))
          }
          formatter={(v) => [`${v ?? ''}${unit}`, '']}
          cursor={{ stroke: GRID }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.25}
          fill={`url(#${gradId})`}
          connectNulls={false}
          // A single point draws no line segment — without a dot the chart
          // looks empty right after the first log ("did it even save?").
          dot={logged.length < 3 ? { r: 3.5, fill: color, strokeWidth: 0 } : false}
          activeDot={{ r: 4, fill: color, stroke: 'rgba(0,0,0,0.4)', strokeWidth: 4 }}
          animationDuration={600}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface BarTotalsProps {
  data: { label: string; count: number }[]
  color: string
  height?: number
}

export function BarTotals({ data, color, height = 160 }: BarTotalsProps) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <EmptyChart height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: AXIS, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={34}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="count" radius={[6, 6, 2, 2]} animationDuration={600}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground"
      style={{ height }}
    >
      No data yet
    </div>
  )
}
