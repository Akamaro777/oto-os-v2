import { Flame } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { useStreaks } from '@/lib/streaks'
import { PILLAR_META } from '@/lib/pillars'

/** Current streaks for the three habits that compound: deep work, calls, showing up. */
export function StreaksCard({ date }: { date: string }) {
  const streaks = useStreaks(date)
  const items = [
    { label: 'Deep work', streak: streaks.deepwork, color: PILLAR_META.cv.color },
    { label: 'Calls', streak: streaks.calls, color: PILLAR_META.money.color },
    { label: 'Logging', streak: streaks.logging, color: PILLAR_META.personal.color },
  ]
  // Hide until at least one streak exists — an all-zero card is just noise.
  if (items.every((i) => i.streak.current === 0 && i.streak.best === 0)) return null

  return (
    <TrackerCard title="Streaks">
      <div className="grid grid-cols-3 gap-2 text-center">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl bg-secondary/40 px-1 py-2.5">
            <p className="flex items-center justify-center gap-1 font-serif text-2xl" style={{ color: i.color }}>
              <Flame className="size-4" style={{ opacity: i.streak.current > 0 ? 1 : 0.25 }} />
              {i.streak.current}
            </p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              {i.label}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground/60">best {i.streak.best}</p>
          </div>
        ))}
      </div>
    </TrackerCard>
  )
}
