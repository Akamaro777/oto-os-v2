import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { shortDate } from '@/lib/dates'
import { GMAT_PLAN, KIND_META, SUBJECT_META, planFor, planIndex, type PlanDay } from '@/lib/gmatPlan'
import { useRules, toggleRule } from '@/store/rules'

/** Today's GMAT session: what to study in the 3h morning block. */
export function StudyPlanCard({ date }: { date: string }) {
  const day = planFor(date)
  const pos = planIndex(date)
  const rules = useRules(date)
  const [allOpen, setAllOpen] = useState(false)

  if (!day) return null
  const meta = KIND_META[day.kind]

  return (
    <>
      <TrackerCard
        title="GMAT today"
        action={
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            className="flex items-center gap-0.5 font-mono text-[11px] text-muted-foreground"
          >
            {pos ? `day ${pos.day}/${pos.total}` : 'plan'}
            <ChevronRight className="size-3" />
          </button>
        }
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
            style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
          >
            {meta.label}
          </span>
          {day.subject && (
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
              style={{
                backgroundColor: `${SUBJECT_META[day.subject].color}22`,
                color: SUBJECT_META[day.subject].color,
              }}
            >
              {SUBJECT_META[day.subject].label}
            </span>
          )}
        </div>
        <p className="mb-2 text-sm font-medium">{day.title}</p>

        <ul className="space-y-1.5">
          {day.items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              {item}
            </li>
          ))}
        </ul>

        {day.kind !== 'rest' && day.kind !== 'exam' && (
          <button
            type="button"
            onClick={() => toggleRule(date, 'deepwork')}
            className="mt-3 flex w-full items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-left"
          >
            <Checkbox checked={rules.deepwork} className="pointer-events-none" />
            <span className={cn('text-sm', rules.deepwork && 'text-muted-foreground line-through')}>
              Session done
            </span>
          </button>
        )}
      </TrackerCard>

      <FullPlanSheet open={allOpen} onOpenChange={setAllOpen} today={date} />
    </>
  )
}

/** The whole 50-day plan, scrollable, with today highlighted. */
function FullPlanSheet({
  open,
  onOpenChange,
  today,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  today: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-heavy mx-auto flex h-[85dvh] max-w-md flex-col gap-4 rounded-t-3xl border-0 px-5 pb-8"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-serif text-2xl">GMAT plan · to Sep 30</SheetTitle>
        </SheetHeader>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <ul className="space-y-1.5">
            {GMAT_PLAN.map((p) => (
              <PlanRow key={p.date} day={p} isToday={p.date === today} isPast={p.date < today} />
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PlanRow({ day, isToday, isPast }: { day: PlanDay; isToday: boolean; isPast: boolean }) {
  const meta = KIND_META[day.kind]
  const rules = useRules(day.date)
  return (
    <li
      className={cn(
        'rounded-xl px-3 py-2 transition-colors',
        isToday ? 'bg-primary/12 ring-1 ring-primary/30' : 'bg-secondary/30',
        isPast && !isToday && 'opacity-55',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">
          {shortDate(day.date)}
        </span>
        <span
          className="w-14 shrink-0 rounded-full px-1.5 py-0.5 text-center font-mono text-[9px] uppercase"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          {meta.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px]">{day.title}</span>
        {day.subject && (
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: SUBJECT_META[day.subject].color }}
          />
        )}
        {rules.deepwork && <Check className="size-3.5 shrink-0 text-primary" />}
      </div>
      {isToday && (
        <ul className="mt-1.5 space-y-0.5 pl-14">
          {day.items.map((item) => (
            <li key={item} className="text-[11px] text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
