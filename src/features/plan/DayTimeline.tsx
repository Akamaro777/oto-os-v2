import { useMemo } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CalendarClock, Check, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pillarColor } from '@/lib/pillars'
import { celebrateFromEvent } from '@/lib/celebrate'
import { parseHM, formatHM } from '@/lib/dates'
import { type Block, type CalendarEvent } from '@/store/schema'
import {
  useBlocksByDate,
  toggleBlock,
  updateBlock,
  layoutColumns,
  type TimedItem,
} from '@/store/planner'
import { useEventsByDate } from '@/store/events'
import { useDayWindow } from '@/store/profile'

const HOUR_PX = 56
const GUTTER = 48
const MIN_BLOCK_PX = 24
const DEFAULT_DURATION = 60
const SNAP = 15 // minutes

interface GridItem extends TimedItem {
  kind: 'block' | 'event'
  block?: Block
  event?: CalendarEvent
}

interface DayTimelineProps {
  date: string
  onNewBlock: (startHM: string) => void
  onEditBlock: (block: Block) => void
}

export function DayTimeline({ date, onNewBlock, onEditBlock }: DayTimelineProps) {
  const { startH, endH } = useDayWindow()
  const blocks = useBlocksByDate(date)
  const events = useEventsByDate(date)
  // Mouse drags on a small movement; touch needs a deliberate long-press so a
  // scroll swipe that lands on a block scrolls instead of rescheduling it.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const laidOut = useMemo(() => {
    const items: GridItem[] = []
    for (const b of blocks) {
      const s = parseHM(b.start)
      const e = b.end ? parseHM(b.end) : s + DEFAULT_DURATION
      items.push({ id: `b:${b.id}`, startMin: s, endMin: Math.max(e, s + 15), kind: 'block', block: b })
    }
    for (const ev of events) {
      if (!ev.time) continue
      const s = parseHM(ev.time)
      items.push({ id: `e:${ev.id}`, startMin: s, endMin: s + DEFAULT_DURATION, kind: 'event', event: ev })
    }
    return layoutColumns(items)
  }, [blocks, events])

  // The grid covers the configured day window, grown (to whole hours, within
  // the day) to fit anything scheduled outside it — a 06:00 flight must not
  // collapse onto the 07:00 line over a real block.
  const itemStartMin = laidOut.length ? Math.min(...laidOut.map((l) => l.item.startMin)) : startH * 60
  const itemEndMin = laidOut.length ? Math.max(...laidOut.map((l) => l.item.endMin)) : endH * 60
  const windowStart = Math.max(0, Math.min(startH * 60, Math.floor(itemStartMin / 60) * 60))
  const windowEnd = Math.max(endH * 60, Math.min(24 * 60, Math.ceil(itemEndMin / 60) * 60))
  const height = ((windowEnd - windowStart) / 60) * HOUR_PX

  const allDay = events.filter((e) => !e.time)

  const hours = Array.from({ length: (windowEnd - windowStart) / 60 }, (_, i) => windowStart / 60 + i)

  function handleDragEnd(event: DragEndEvent) {
    const b = blocks.find((x) => x.id === event.active.id)
    if (!b) return
    const deltaMin = Math.round((event.delta.y / HOUR_PX) * 60 / SNAP) * SNAP
    if (deltaMin === 0) return
    const s = parseHM(b.start)
    const e = b.end ? parseHM(b.end) : s + DEFAULT_DURATION
    const duration = e - s
    const newStart = Math.max(windowStart, Math.min(windowEnd - duration, s + deltaMin))
    updateBlock(b.id, {
      title: b.title,
      start: formatHM(newStart),
      end: b.end ? formatHM(newStart + duration) : '',
      category: b.category,
      taskId: b.taskId,
    })
  }

  return (
    <div>
      {allDay.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {allDay.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-secondary/60 px-2 py-1 font-mono text-[11px] text-muted-foreground"
            >
              <CalendarClock className="size-3" />
              {e.title}
            </span>
          ))}
        </div>
      )}

      <div className="relative" style={{ height }}>
        {hours.map((h) => (
          <button
            type="button"
            key={h}
            onClick={() => onNewBlock(`${String(h).padStart(2, '0')}:00`)}
            aria-label={`Add block at ${String(h).padStart(2, '0')}:00`}
            className="absolute inset-x-0 border-t border-border/50 transition-colors hover:bg-secondary/30"
            style={{ top: (h - windowStart / 60) * HOUR_PX, height: HOUR_PX }}
          >
            <span className="absolute -top-2 left-0 w-11 text-right font-mono text-[10px] text-muted-foreground">
              {String(h).padStart(2, '0')}:00
            </span>
          </button>
        ))}
        <div className="absolute inset-x-0 border-t border-border/50" style={{ top: height }} />

        <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: GUTTER }}>
            {laidOut.map(({ item, lane, lanes }) => {
              const s = Math.max(item.startMin, windowStart)
              const e = Math.min(item.endMin, windowEnd)
              const top = ((s - windowStart) / 60) * HOUR_PX
              const blockH = Math.max(((e - s) / 60) * HOUR_PX, MIN_BLOCK_PX)
              const widthPct = 100 / lanes
              const leftPct = lane * widthPct
              const geom = { top, height: blockH, leftPct, widthPct }

              if (item.kind === 'event' && item.event) {
                return <EventChip key={item.id} event={item.event} geom={geom} />
              }
              return (
                <DraggableBlock
                  key={item.id}
                  block={item.block!}
                  geom={geom}
                  onEdit={onEditBlock}
                />
              )
            })}
          </div>
        </DndContext>
      </div>

      {blocks.length === 0 && (
        <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
          Tap any hour to add a block · window {formatHM(windowStart)}–{formatHM(windowEnd)}
        </p>
      )}
    </div>
  )
}

interface Geom {
  top: number
  height: number
  leftPct: number
  widthPct: number
}

function positionStyle(geom: Geom): React.CSSProperties {
  return {
    top: geom.top,
    height: geom.height,
    left: `calc(${geom.leftPct}% + 2px)`,
    width: `calc(${geom.widthPct}% - 4px)`,
  }
}

function EventChip({ event, geom }: { event: CalendarEvent; geom: Geom }) {
  return (
    <div
      className="pointer-events-auto absolute overflow-hidden rounded-md border border-dashed border-muted-foreground/40 bg-secondary/70 px-2 py-1"
      style={positionStyle(geom)}
      onClick={(ev) => ev.stopPropagation()}
    >
      <p className="flex items-center gap-1 truncate font-mono text-[11px] text-muted-foreground">
        <CalendarClock className="size-3 shrink-0" />
        {event.title}
      </p>
    </div>
  )
}

function DraggableBlock({
  block,
  geom,
  onEdit,
}: {
  block: Block
  geom: Geom
  onEdit: (block: Block) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: block.id })
  const color = pillarColor(block.category)
  const style: React.CSSProperties = {
    ...positionStyle(geom),
    borderLeftColor: color,
    transform: transform ? `translateY(${transform.y}px)` : undefined,
    zIndex: isDragging ? 30 : undefined,
    opacity: isDragging ? 0.9 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      onClick={() => onEdit(block)}
      onKeyDown={(ev) => ev.key === 'Enter' && onEdit(block)}
      className={cn(
        // touch-manipulation (not touch-none): scroll swipes must keep working
        // over blocks; the TouchSensor's long-press handles drag activation.
        'pointer-events-auto absolute flex select-none touch-manipulation gap-1.5 overflow-hidden rounded-md border-l-2 px-2 py-1 text-left',
        block.done ? 'bg-secondary/50' : 'bg-secondary',
        isDragging && 'shadow-lg ring-1 ring-primary/40',
      )}
      style={{ ...style, WebkitTouchCallout: 'none' } as React.CSSProperties}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => {
          ev.stopPropagation()
          if (!block.done) celebrateFromEvent(ev)
          toggleBlock(block.id)
        }}
        aria-label={block.done ? 'Mark not done' : 'Mark done'}
        className={cn(
          'mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border',
          block.done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50',
        )}
      >
        {block.done && <Check className="size-2.5" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-xs font-medium leading-tight',
            block.done && 'text-muted-foreground line-through',
          )}
        >
          {block.title}
        </p>
        {geom.height > 34 && (
          <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10px] text-muted-foreground">
            {block.start}
            {block.end ? `–${block.end}` : ''}
            {block.taskId && <Link2 className="size-2.5" />}
          </p>
        )}
      </div>
    </div>
  )
}
