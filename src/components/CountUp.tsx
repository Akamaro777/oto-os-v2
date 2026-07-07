import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'

interface CountUpProps {
  value: number
  /** Renders the animated value — default: rounded integer. */
  format?: (v: number) => string
  className?: string
  style?: React.CSSProperties
  duration?: number
}

/** Number that springs from its previous value to the new one — data feels alive. */
export function CountUp({ value, format, className, style, duration = 0.9 }: CountUpProps) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(0)
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (reduced.current) {
      setDisplay(value)
      prev.current = value
      return
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    })
    prev.current = value
    return () => controls.stop()
  }, [value, duration])

  const fmt = format ?? ((v: number) => String(Math.round(v)))
  return (
    <span className={className} style={style}>
      {fmt(display)}
    </span>
  )
}
