import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Mic, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TrackerCard } from '@/components/TrackerCard'
import { VoiceDialog } from '@/components/VoiceDialog'
import { cn } from '@/lib/utils'
import { pillarColor } from '@/lib/pillars'
import { todayISO, toISO, shortDate } from '@/lib/dates'
import { captureEvents } from '@/lib/aiCapture'
import { type CalendarEvent } from '@/store/schema'
import { useAllEvents } from '@/store/events'
import { EventDialog } from './EventDialog'

/** Month grid + day agenda + upcoming list, with manual and voice event capture. */
export function CalendarView() {
  const today = todayISO()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(today)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | undefined>(undefined)

  const events = useAllEvents()
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [events])

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(month, { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  )

  const dayEvents = (byDate.get(selected) ?? []).sort((a, b) =>
    (a.time ?? '').localeCompare(b.time ?? ''),
  )
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
        .slice(0, 6),
    [events, today],
  )

  return (
    <div className="space-y-4">
      <TrackerCard
        title={format(month, 'MMMM yyyy')}
        action={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-1 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="pb-1 font-mono text-[9px] uppercase text-muted-foreground">
              {d}
            </span>
          ))}
          {days.map((d) => {
            const iso = toISO(d)
            const inMonth = d.getMonth() === month.getMonth()
            const dots = (byDate.get(iso) ?? []).slice(0, 3)
            const isSelected = iso === selected
            const isToday = iso === today
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={cn(
                  'pressable flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition-colors',
                  !inMonth && 'opacity-30',
                  isSelected
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : isToday
                      ? 'bg-secondary font-semibold text-primary'
                      : 'hover:bg-secondary',
                )}
              >
                {d.getDate()}
                <span className="mt-0.5 flex h-1 gap-0.5">
                  {dots.map((e) => (
                    <span
                      key={e.id}
                      className="size-1 rounded-full"
                      style={{
                        backgroundColor: isSelected ? 'rgba(0,0,0,0.55)' : pillarColor(e.category),
                      }}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </TrackerCard>

      <TrackerCard
        title={selected === today ? 'Today' : shortDate(selected)}
        action={
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setVoiceOpen(true)}>
              <Mic className="size-3.5" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setEditing(undefined); setDialogOpen(true) }}>
              <Plus className="size-3.5" /> Event
            </Button>
          </div>
        }
      >
        {dayEvents.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Nothing scheduled.</p>
        ) : (
          <ul className="divide-y divide-border">
            {dayEvents.map((e) => (
              <EventRow key={e.id} event={e} onEdit={(ev) => { setEditing(ev); setDialogOpen(true) }} />
            ))}
          </ul>
        )}
      </TrackerCard>

      {upcoming.length > 0 && (
        <TrackerCard title="Upcoming">
          <ul className="divide-y divide-border">
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} showDate onEdit={(ev) => { setEditing(ev); setDialogOpen(true) }} />
            ))}
          </ul>
        </TrackerCard>
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(undefined) }}
        defaultDate={selected}
        event={editing}
      />
      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        title="Add events"
        hint="Say what and when — I'll place it on the calendar"
        placeholder="e.g. GMAT exam August 5th at 9am, dinner with Anna Friday 19:30…"
        process={captureEvents}
      />
    </div>
  )
}

function EventRow({
  event,
  showDate,
  onEdit,
}: {
  event: CalendarEvent
  showDate?: boolean
  onEdit: (e: CalendarEvent) => void
}) {
  return (
    <li>
      <button type="button" onClick={() => onEdit(event)} className="flex w-full items-center gap-2.5 py-2.5 text-left">
        <CalendarClock className="size-3.5 shrink-0" style={{ color: pillarColor(event.category) }} />
        <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {showDate && `${shortDate(event.date)} `}
          {event.time || 'all day'}
        </span>
      </button>
    </li>
  )
}
