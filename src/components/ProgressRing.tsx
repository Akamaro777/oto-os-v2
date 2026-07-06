import { useId } from 'react'
import { motion } from 'motion/react'

interface ProgressRingProps {
  pct: number
  /** Where the on-pace marker sits (0–100). */
  markerPct?: number
  color: string
  size?: number
  stroke?: number
  children?: React.ReactNode
}

/** Circular progress with gradient stroke, soft glow, draw-in animation and an on-pace tick. */
export function ProgressRing({
  pct,
  markerPct,
  color,
  size = 72,
  stroke = 6,
  children,
}: ProgressRingProps) {
  const gradId = useId()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = c * (1 - clamped / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}
        />
        {markerPct != null && <MarkerTick size={size} r={r} pct={markerPct} />}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

function MarkerTick({ size, r, pct }: { size: number; r: number; pct: number }) {
  const angle = (Math.max(0, Math.min(100, pct)) / 100) * 2 * Math.PI
  const cx = size / 2 + r * Math.cos(angle)
  const cy = size / 2 + r * Math.sin(angle)
  return <circle cx={cx} cy={cy} r={2.5} fill="#ededf0" />
}
