/**
 * Fixed ambient light blobs behind all content — the "cinema dark" atmosphere.
 * Pure CSS (GPU transforms only), disabled by prefers-reduced-motion.
 */
export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="ambient-blob absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-[0.13] blur-3xl"
        style={{ background: 'radial-gradient(circle, #c9f158 0%, transparent 70%)' }}
      />
      <div
        className="ambient-blob absolute right-[-20%] top-1/3 h-80 w-80 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: 'radial-gradient(circle, #7dd3fc 0%, transparent 70%)', animationDelay: '-9s' }}
      />
      <div
        className="ambient-blob absolute bottom-[-10%] left-[-15%] h-96 w-96 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'radial-gradient(circle, #f0abfc 0%, transparent 70%)', animationDelay: '-18s' }}
      />
    </div>
  )
}
