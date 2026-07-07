/**
 * Fixed ambient light blobs behind all content — the "cinema dark" atmosphere.
 * The palette follows the time of day: warm dawn, lime day, amber dusk, violet night.
 * Pure CSS (GPU transforms only), disabled by prefers-reduced-motion.
 */

interface Palette {
  a: string
  b: string
  c: string
}

function paletteForHour(h: number): Palette {
  if (h >= 5 && h < 10) return { a: '#fbbf24', b: '#f0abfc', c: '#c9f158' } // dawn
  if (h >= 10 && h < 17) return { a: '#c9f158', b: '#7dd3fc', c: '#f0abfc' } // day
  if (h >= 17 && h < 22) return { a: '#fb923c', b: '#a78bfa', c: '#c9f158' } // dusk
  return { a: '#7dd3fc', b: '#a78bfa', c: '#4ade80' } // night
}

export function Ambient() {
  const p = paletteForHour(new Date().getHours())
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="ambient-blob absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-[0.13] blur-3xl"
        style={{ background: `radial-gradient(circle, ${p.a} 0%, transparent 70%)` }}
      />
      <div
        className="ambient-blob absolute right-[-20%] top-1/3 h-80 w-80 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: `radial-gradient(circle, ${p.b} 0%, transparent 70%)`, animationDelay: '-9s' }}
      />
      <div
        className="ambient-blob absolute bottom-[-10%] left-[-15%] h-96 w-96 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: `radial-gradient(circle, ${p.c} 0%, transparent 70%)`, animationDelay: '-18s' }}
      />
    </div>
  )
}
