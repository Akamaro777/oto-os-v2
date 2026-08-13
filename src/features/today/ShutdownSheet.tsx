import { useEffect, useState } from 'react'
import { Moon, Check } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrackerCard } from '@/components/TrackerCard'
import { cn } from '@/lib/utils'
import { tomorrowISO } from '@/lib/dates'
import { useStreaks } from '@/lib/streaks'
import { useSocialLog, setSocialRating } from '@/store/social'
import { useRules, toggleRule } from '@/store/rules'
import { useCvLog } from '@/store/study'
import { getProfileNumber } from '@/store/profile'
import { useTop3, setTop3 } from '@/store/planner'
import { celebrate } from '@/lib/celebrate'

/**
 * The 60-second evening shutdown: rate the day, tick the non-negotiables,
 * set tomorrow's #1, see the streak. Every input already existed in the app —
 * this choreographs them into one guided moment at 21:30.
 */
export function ShutdownCard({ date, nowMin }: { date: string; nowMin: number }) {
  const [open, setOpen] = useState(false)
  const log = useSocialLog(date)
  const isEvening = nowMin >= 20 * 60
  const done = log?.rating != null

  // Surface the card in the evening until the day is rated.
  if (!isEvening || done) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass edge-light pressable flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-primary"
      >
        <Moon className="size-4" /> Close the day
      </button>
      <ShutdownSheet open={open} onOpenChange={setOpen} date={date} />
    </>
  )
}

export function ShutdownSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  date: string
}) {
  const log = useSocialLog(date)
  const rules = useRules(date)
  const cv = useCvLog(date)
  const callsTarget = getProfileNumber('callsDailyTarget') || 70
  const streaks = useStreaks(date)
  const tomorrow = tomorrowISO()
  const tomorrowTop = useTop3(tomorrow)
  const [focus, setFocus] = useState('')

  useEffect(() => {
    if (open) setFocus(tomorrowTop[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const rating = log?.rating ?? 0
  const callsAuto = (cv?.calls ?? 0) >= callsTarget

  function finish() {
    if (focus.trim()) setTop3(tomorrow, 0, focus)
    if (rating >= 7) celebrate()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-heavy mx-auto flex max-h-[92dvh] max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-3xl border-0 px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)]"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <Moon className="size-5 text-primary" /> Close the day
          </SheetTitle>
        </SheetHeader>

        {/* 1 · Rate the day */}
        <TrackerCard title="How was it?">
          <div className="flex justify-between gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSocialRating(date, n)}
                className={cn(
                  'flex h-9 flex-1 items-center justify-center rounded-lg font-mono text-xs transition-colors',
                  rating === n
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'bg-secondary/60 text-muted-foreground',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </TrackerCard>

        {/* 2 · Non-negotiables */}
        <TrackerCard title="Non-negotiables">
          <div className="space-y-1">
            {(
              [
                { key: 'deepwork' as const, label: '3h GMAT deep work', checked: rules.deepwork, auto: false },
                { key: 'noon' as const, label: 'Out by 12:00', checked: rules.noon, auto: false },
                {
                  key: 'calls' as const,
                  label: `${callsTarget} cold calls`,
                  checked: rules.calls || callsAuto,
                  auto: callsAuto,
                },
              ]
            ).map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  if (!r.auto) toggleRule(date, r.key)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left"
              >
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-[4px] border',
                    r.checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )}
                >
                  {r.checked && <Check className="size-3" />}
                </span>
                <span className={cn('text-sm', r.checked && 'text-muted-foreground line-through')}>
                  {r.label}
                </span>
              </button>
            ))}
          </div>
        </TrackerCard>

        {/* 3 · Tomorrow's #1 */}
        <TrackerCard title="Tomorrow's #1">
          <Input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && finish()}
            placeholder="The one thing that must happen…"
          />
        </TrackerCard>

        {/* 4 · Streak */}
        {streaks.deepwork.current > 0 && (
          <p className="text-center font-mono text-[11px] text-muted-foreground">
            🔥 {streaks.deepwork.current}-day deep-work streak — keep it alive tomorrow.
          </p>
        )}

        <Button className="glow-primary w-full rounded-xl py-5" onClick={finish}>
          Done — see you tomorrow
        </Button>
      </SheetContent>
    </Sheet>
  )
}
