import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { celebrateFromEvent } from '@/lib/celebrate'
import { GYM_SLOTS, useGymWeek, toggleGymSession, type GymSlot } from '@/store/body'
import { isoWeekKey, todayISO, shortDate } from '@/lib/dates'

/** Current-week training grid. Tap a tile to mark done today; tap again to clear. */
export function TrainingGrid() {
  const week = isoWeekKey()
  const data = useGymWeek(week)

  return (
    <div className="grid grid-cols-3 gap-2">
      {GYM_SLOTS.map(({ key, label }) => {
        const doneDate = data[key as GymSlot]
        const done = Boolean(doneDate)
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              if (!done) celebrateFromEvent(e)
              toggleGymSession(week, key, todayISO())
            }}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border px-1 py-3 transition-colors',
              done
                ? 'border-pillar-body/50 bg-pillar-body/10'
                : 'border-border bg-secondary/40 hover:bg-secondary',
            )}
          >
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full',
                done ? 'bg-pillar-body text-background' : 'bg-secondary text-muted-foreground',
              )}
            >
              {done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="text-center text-[10px] font-medium leading-tight">{label}</span>
            <span className="font-mono text-[9px] text-muted-foreground">
              {done ? shortDate(doneDate as string) : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
