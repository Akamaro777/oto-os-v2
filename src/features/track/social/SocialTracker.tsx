import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { DayStepper } from '@/components/DayStepper'
import { Textarea } from '@/components/ui/textarea'
import { LineTrend } from '@/components/charts'
import { cn } from '@/lib/utils'
import { todayISO, shortDate } from '@/lib/dates'
import { PILLAR_META } from '@/lib/pillars'
import { getProfileNumber } from '@/store/profile'
import {
  useSocialLog,
  setSocialRating,
  setSocialNote,
  bumpSocialCounter,
  useSocialSeries,
  useRecentSocialNotes,
  type SocialCounter,
} from '@/store/social'

const SOCIAL = PILLAR_META.social.color

const COUNTERS: { key: SocialCounter; label: string; target: string }[] = [
  { key: 'approaches', label: 'Approaches', target: 'socialDailyApproaches' },
  { key: 'compliments', label: 'Compliments', target: 'socialDailyCompliments' },
  { key: 'connections', label: 'Connections', target: 'socialDailyConnections' },
]

export function SocialTracker() {
  const [date, setDate] = useState(todayISO())
  const log = useSocialLog(date)
  const series = useSocialSeries(7)
  const notes = useRecentSocialNotes()

  return (
    <div className="space-y-4">
      <DayStepper date={date} onChange={setDate} />

      <TrackerCard title="Day rating">
        <div className="mb-2 text-center">
          <span className="font-serif text-4xl" style={{ color: SOCIAL }}>
            {log?.rating ?? '—'}
          </span>
          <span className="font-mono text-sm text-muted-foreground">/10</span>
        </div>
        <div className="flex justify-between gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const filled = log?.rating != null && n <= log.rating
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSocialRating(date, n)}
                aria-label={`Rate ${n}`}
                className={cn(
                  'h-8 flex-1 rounded-md text-[11px] font-medium transition-colors',
                  filled ? 'text-background' : 'bg-secondary text-muted-foreground',
                )}
                style={filled ? { backgroundColor: SOCIAL } : undefined}
              >
                {n}
              </button>
            )
          })}
        </div>
      </TrackerCard>

      <TrackerCard title="Daily reps">
        <div className="space-y-3">
          {COUNTERS.map(({ key, label, target }) => {
            const value = log?.[key] ?? 0
            const goal = getProfileNumber(target)
            return (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{label}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">target {goal}/day</p>
                </div>
                <div className="flex items-center gap-3">
                  <Stepper onDec={() => bumpSocialCounter(date, key, -1)} onInc={() => bumpSocialCounter(date, key, 1)}>
                    <span
                      className={cn(
                        'w-8 text-center font-mono text-lg tabular-nums',
                        value >= goal && goal > 0 ? 'text-pillar-social' : 'text-foreground',
                      )}
                    >
                      {value}
                    </span>
                  </Stepper>
                </div>
              </div>
            )
          })}
        </div>
      </TrackerCard>

      <TrackerCard title="Note">
        <NoteField date={date} value={log?.note ?? ''} />
      </TrackerCard>

      <TrackerCard title="Rating — last 7 days">
        <LineTrend data={series} color={SOCIAL} unit="/10" target={undefined} height={150} />
      </TrackerCard>

      {notes.length > 0 && (
        <TrackerCard title="Recent notes">
          <ul className="divide-y divide-border">
            {notes.map((n) => (
              <li key={n.date} className="py-2">
                <p className="text-sm">{n.note}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {shortDate(n.date)} · score {n.rating ?? '—'}/10
                </p>
              </li>
            ))}
          </ul>
        </TrackerCard>
      )}
    </div>
  )
}

function Stepper({
  onDec,
  onInc,
  children,
}: {
  onDec: () => void
  onInc: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDec}
        aria-label="Decrease"
        className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
      >
        <Minus className="size-4" />
      </button>
      {children}
      <button
        type="button"
        onClick={onInc}
        aria-label="Increase"
        className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

function NoteField({ date, value }: { date: string; value: string }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value, date])
  return (
    <Textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && setSocialNote(date, text)}
      placeholder="How did today go socially?"
      rows={2}
    />
  )
}
