import {
  Line,
  LineChart,
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

const AXIS = '#8b8d95'
const GRID = 'rgba(255,255,255,0.08)'

const tooltipStyle = {
  background: '#16181d',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
  padding: '6px 10px',
} as const

interface LineTrendProps {
  data: { date: string; value: number }[]
  color: string
  unit?: string
  /** Optional target line. */
  target?: number
  height?: number
}

export function LineTrend({ data, color, unit = '', target, height = 160 }: LineTrendProps) {
  if (data.length === 0) {
    return <EmptyChart height={height} />
  }
  const values = data.map((d) => d.value)
  if (target != null) values.push(target)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min || 1) * 0.15

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: AXIS, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={28}
        />
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
            strokeOpacity={0.5}
            label={{ value: `${target}${unit}`, fill: AXIS, fontSize: 10, position: 'insideTopRight' }}
          />
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v) => [`${v ?? ''}${unit}`, '']}
          cursor={{ stroke: GRID }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </LineChart>
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
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground"
      style={{ height }}
    >
      No data yet
    </div>
  )
}
