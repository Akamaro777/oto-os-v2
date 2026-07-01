import { useMemo } from 'react'
import { Circle, Clock, ArrowRight, ListChecks, Users, Cake } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { TrackerCard } from '@/components/TrackerCard'
import { ProgressRing } from '@/components/ProgressRing'
import { cn } from '@/lib/utils'
import { PILLAR_META, pillarColor } from '@/lib/pillars'
import { todayISO, relativeDueLabel } from '@/lib/dates'
import { reconnectDue, birthdaySoon } from '@/lib/people'
import { getProfileString } from '@/store/profile'
import { useNorthStars, type GoalStatus } from '@/store/northStars'
import { useBlocksByDate, computeNowNext, useTop3 } from '@/store/planner'
import { useAllTasks, filterTasks, sortTasks } from '@/store/tasks'
import { useAllContacts } from '@/store/people'

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

export function TodayScreen() {
  const today = todayISO()
  const stars = useNorthStars()
  const blocks = useBlocksByDate(today)
  const top3 = useTop3(today)
  const tasks = useAllTasks()
  const contacts = useAllContacts()

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const { now, next } = useMemo(() => computeNowNext(blocks, nowMin), [blocks, nowMin])

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
    <Screen title={greeting()} subtitle={getProfileString('name') || 'oto.os'}>
      <div className="space-y-4">
        {/* North Stars */}
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          {stars.map((s) => {
            const color = pillarColor(s.pillar)
            return (
              <div
                key={s.id}
                className="flex w-40 shrink-0 flex-col items-center gap-2 rounded-xl border border-border bg-card p-4"
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
              </div>
            )
          })}
        </div>

        {/* Now / Next */}
        <TrackerCard title="Now · Next">
          {now || next ? (
            <div className="space-y-3">
              {now && <TimelineRow label="Now" block={now} highlight />}
              {next && <TimelineRow label="Next" block={next} />}
              {!now && !next && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No blocks planned for today.</p>
          )}
        </TrackerCard>

        {/* Top 3 */}
        {activeTop3.length > 0 && (
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
        )}

        {/* Tasks */}
        {(overdue.length > 0 || dueToday.length > 0) && (
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
        )}

        {/* People to reach */}
        {reach.length > 0 && (
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
        )}

        {stars.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <ListChecks className="size-8" />
            <p className="text-sm">Log some data and your briefing fills in.</p>
          </div>
        )}
      </div>
    </Screen>
  )
}

function TimelineRow({
  label,
  block,
  highlight,
}: {
  label: string
  block: { title: string; start: string; end: string; category?: string }
  highlight?: boolean
}) {
  const color = pillarColor(block.category)
  const pillar = block.category ? PILLAR_META[
    block.category as keyof typeof PILLAR_META
  ]?.label : undefined
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg',
          highlight ? 'text-background' : 'bg-secondary text-muted-foreground',
        )}
        style={highlight ? { backgroundColor: color } : undefined}
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
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
