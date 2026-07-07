/**
 * Lightweight particle burst for completions — no canvas, no deps.
 * Spawns a handful of glowing dots at (x, y) that fly outward and fade.
 * Respects prefers-reduced-motion.
 */

const COLORS = ['#c9f158', '#c9f158', '#fb923c', '#7dd3fc', '#f0abfc', '#4ade80']

export function celebrate(x?: number, y?: number): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const cx = x ?? window.innerWidth / 2
  const cy = y ?? window.innerHeight / 2

  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;'
  document.body.appendChild(host)

  const count = 14
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div')
    const size = 4 + Math.random() * 5
    const color = COLORS[i % COLORS.length]
    dot.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};will-change:transform,opacity;`
    host.appendChild(dot)

    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6
    const dist = 42 + Math.random() * 46
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 14 // slight upward bias

    dot.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`,
          opacity: 0,
        },
      ],
      { duration: 620 + Math.random() * 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
    )
  }
  setTimeout(() => host.remove(), 950)
}

/** Convenience: burst from the centre of the event's target element. */
export function celebrateFromEvent(e: { currentTarget: EventTarget | null }): void {
  const el = e.currentTarget as HTMLElement | null
  if (!el || typeof el.getBoundingClientRect !== 'function') {
    celebrate()
    return
  }
  const r = el.getBoundingClientRect()
  celebrate(r.left + r.width / 2, r.top + r.height / 2)
}
