interface ProgressRingProps {
  pct: number
  /** Where the on-pace marker sits (0–100). */
  markerPct?: number
  color: string
  size?: number
  stroke?: number
  children?: React.ReactNode
}

/** Circular progress with an optional on-pace tick. */
export function ProgressRing({
  pct,
  markerPct,
  color,
  size = 72,
  stroke = 6,
  children,
}: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = c * (1 - clamped / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        {markerPct != null && (
          <MarkerTick size={size} r={r} pct={markerPct} />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

function MarkerTick({ size, r, pct }: { size: number; r: number; pct: number }) {
  const angle = (Math.max(0, Math.min(100, pct)) / 100) * 2 * Math.PI
  const cx = size / 2 + r * Math.cos(angle)
  const cy = size / 2 + r * Math.sin(angle)
  return <circle cx={cx} cy={cy} r={2.5} fill="#e8e8ec" />
}
