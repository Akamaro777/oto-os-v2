import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Circle, Clock, ArrowRight, ListChecks, Users, Cake } from 'lucide-react'
import { Screen, Stagger, StaggerItem } from '@/components/Screen'
import { TrackerCard } from '@/components/TrackerCard'
import { ProgressRing } from '@/components/ProgressRing'
import { cn } from '@/lib/utils'
import { PILLAR_META, pillarColor } from '@/lib/pillars'
import { todayISO, relativeDueLabel, parseHM } from '@/lib/dates'
import { reconnectDue, birthdaySoon } from '@/lib/people'
import { useDeviceTilt, requestTiltPermission } from '@/lib/tilt'
import { getProfileString } from '@/store/profile'
import { useNorthStars, type GoalStatus } from '@/store/northStars'
import { useBlocksByDate, computeNowNext, useTop3 } from '@/store/planner'
import { useAllTasks, filterTasks, sortTasks } from '@/store/tasks'
import { useAllContacts } from '@/store/people'
import { GoalDetailSheet } from './GoalDetailSheet'

const STATUS_COLOR: Record<GoalStatus, string> = {
  complete: '#c9f158',
  ahead: '#c9f158',
  ontrack: '#8b8d95',
  behind: '#fbbf24',
  danger: '#ef4444',
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function currentMinutes(): number {
  return new Date().getHours() * 60 + new Date().getMinutes()
}

export function TodayScreen() {
  const today = todayISO()
  const stars = useNorthStars()
  const blocks = useBlocksByDate(today)
  const top3 = useTop3(today)
  const tasks = useAllTasks()
  const contacts = useAllContacts()
  // Track the open goal by id so the sheet reflects live edits (counter steppers).
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = detailId ? (stars.find((s) => s.id === detailId) ?? null) : null

  // Ticking clock so the Now-block countdown stays live.
  const [nowMin, setNowMin] = useState(currentMinutes)
  useEffect(() => {
    const t = setInterval(() => setNowMin(currentMinutes()), 30_000)
    return () => clearInterval(t)
  }, [])

  const { now, next } = useMemo(() => computeNowNext(blocks, nowMin), [blocks, nowMin])
  const tilt = useDeviceTilt()

  const dueToday = useMemo(
    () => sortTasks(filterTasks(tasks, 'today', today)),
    [tasks, today],
  )
  const overdue = useMemo(() => sortTasks(filterTasks(tasks, 'overdue', today)), [tasks, today])

  const reach = useMemo(
    () => contacts.filter((c) => reconnectDue(c, today) || birthdaySoon(c, today)),
    [contacts, today],
  )

  const activeTop3 = top3.filter((t) => t.trim())

  return (
    <Screen
      title={greeting()}
      subtitle={`${getProfileString('name') || 'oto.os'} · ${format(new Date(), 'EEEE, MMM d')}`}
    >
      <Stagger className="space-y-4">
        {/* North Stars */}
        <StaggerItem>
        <div
          className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
          style={{ perspective: 700 }}
          onPointerDown={() => requestTiltPermission()}
        >
          {stars.map((s) => {
            const color = pillarColor(s.pillar)
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setDetailId(s.id)}
                aria-label={`${s.label} details`}
                className="glass edge-light pressable flex w-40 shrink-0 flex-col items-center gap-2 rounded-2xl p-4"
                style={{
                  transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                  transition: 'transform 0.2s ease-out',
                }}
              >
                <ProgressRing pct={s.pct} markerPct={s.expectedPct} color={color} size={76}>
                  <span className="font-mono text-sm font-semibold">{Math.round(s.pct)}%</span>
                </ProgressRing>
                <div className="text-center">
                  <p className="text-xs font-medium leading-tight">{s.label}</p>
                  <p className="mt-0.5 font-mono text-[11px]" style={{ color }}>
                    {s.current}
                  </p>
                  <p
                    className="mt-1 font-mono text-[9px] uppercase tracking-wide"
                    style={{ color: STATUS_COLOR[s.status] }}
                  >
                    {s.statusText}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground">
                    {s.pace} · {s.meta}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
        </StaggerItem>

        {/* Now / Next */}
        <StaggerItem>
        <TrackerCard title="Now · Next">
          {now || next ? (
            <div className="space-y-3">
              {now && <TimelineRow label="Now" block={now} highlight nowMin={nowMin} />}
              {next && <TimelineRow label="Next" block={next} />}
              {!now && !next && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No blocks planned for today.</p>
          )}
        </TrackerCard>
        </StaggerItem>

        {/* Top 3 */}
        {activeTop3.length > 0 && (
          <StaggerItem>
          <TrackerCard title="Top 3 today">
            <ol className="space-y-2">
              {activeTop3.map((t, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] text-muted-foreground">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </TrackerCard>
          </StaggerItem>
        )}

        {/* Tasks */}
        {(overdue.length > 0 || dueToday.length > 0) && (
          <StaggerItem>
          <TrackerCard title="On your plate">
            <ul className="space-y-2">
              {overdue.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <Circle className="size-3 shrink-0" style={{ color: pillarColor(t.category) }} />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-destructive">
                    {relativeDueLabel(t.due!)}
                  </span>
                </li>
              ))}
              {dueToday.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <Circle className="size-3 shrink-0" style={{ color: pillarColor(t.category) }} />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">Today</span>
                </li>
              ))}
            </ul>
          </TrackerCard>
          </StaggerItem>
        )}

        {/* People to reach */}
        {reach.length > 0 && (
          <StaggerItem>
          <TrackerCard title="People to reach">
            <ul className="space-y-2">
              {reach.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  {birthdaySoon(c, today) ? (
                    <Cake className="size-3.5 shrink-0 text-pillar-social" />
                  ) : (
                    <Users className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {birthdaySoon(c, today) ? 'birthday' : 'reconnect'}
                  </span>
                </li>
              ))}
            </ul>
          </TrackerCard>
          </StaggerItem>
        )}

        {stars.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <ListChecks className="size-8" />
            <p className="text-sm">Log some data and Today fills in.</p>
          </div>
        )}
      </Stagger>

      <GoalDetailSheet star={detail} onClose={() => setDetailId(null)} />
    </Screen>
  )
}

function TimelineRow({
  label,
  block,
  highlight,
  nowMin,
}: {
  label: string
  block: { title: string; start: string; end: string; category?: string }
  highlight?: boolean
  /** When set (Now row), renders a live countdown + progress bar. */
  nowMin?: number
}) {
  const color = pillarColor(block.category)
  const pillar = block.category ? PILLAR_META[
    block.category as keyof typeof PILLAR_META
  ]?.label : undefined

  // Live progress through the current block
  let remaining: number | null = null
  let progress = 0
  if (highlight && nowMin != null) {
    const start = parseHM(block.start)
    const end = block.end ? parseHM(block.end) : start + 60
    remaining = Math.max(0, end - nowMin)
    progress = Math.min(100, Math.max(0, ((nowMin - start) / Math.max(1, end - start)) * 100))
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            highlight ? 'text-background' : 'bg-secondary text-muted-foreground',
          )}
          style={highlight ? { backgroundColor: color, boxShadow: `0 0 14px ${color}55` } : undefined}
        >
          {highlight ? <Clock className="size-5" /> : <ArrowRight className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{block.title}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {block.start}
            {block.end ? `–${block.end}` : ''}
            {pillar && ` · ${pillar}`}
          </p>
        </div>
        <span className="shrink-0 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {remaining != null ? (
            <>
              <span className="block text-[13px] normal-case tabular-nums" style={{ color }}>
                {remaining >= 60 ? `${Math.floor(remaining / 60)}h ${remaining % 60}m` : `${remaining}m`}
              </span>
              left
            </>
          ) : (
            label
          )}
        </span>
      </div>
      {remaining != null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary" style={{ marginLeft: 52 }}>
          <div
            className="h-full rounded-full transition-[width] duration-1000"
            style={{ width: `${progress}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  )
}
