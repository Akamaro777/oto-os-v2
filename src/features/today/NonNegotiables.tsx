import { useMemo } from 'react'
import { getDay, parseISO } from 'date-fns'
import { BookOpen, DoorOpen, Phone, Footprints } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { PILLAR_META } from '@/lib/pillars'
import { getProfileNumber } from '@/store/profile'
import { useRules, toggleRule, type RuleKey } from '@/store/rules'
import { useCvLog } from '@/store/study'

interface Rule {
  key: RuleKey
  label: string
  sub?: string
  icon: LucideIcon
  color: string
  checked: boolean
}

/** The daily big-rules checklist: deep work, out by noon, cold calls, Sunday run. */
export function NonNegotiables({ date }: { date: string }) {
  const rules = useRules(date)
  const cv = useCvLog(date)
  const callsTarget = getProfileNumber('callsDailyTarget') || 70
  const callsLogged = cv?.calls ?? 0
  const isSunday = getDay(parseISO(date)) === 0

  const items = useMemo(() => {
    const list: Rule[] = [
      {
        key: 'deepwork',
        label: '3h phone-free GMAT deep work',
        icon: BookOpen,
        color: PILLAR_META.cv.color,
        checked: rules.deepwork,
      },
      {
        key: 'noon',
        label: 'Out of the house by 12:00',
        icon: DoorOpen,
        color: PILLAR_META.personal.color,
        checked: rules.noon,
      },
      {
        key: 'calls',
        label: `${callsTarget} cold calls`,
        sub: `${callsLogged}/${callsTarget} logged`,
        icon: Phone,
        color: PILLAR_META.money.color,
        checked: rules.calls || callsLogged >= callsTarget,
      },
    ]
    if (isSunday)
      list.push({
        key: 'run',
        label: 'Sunday run',
        icon: Footprints,
        color: PILLAR_META.body.color,
        checked: rules.run,
      })
    return list
  }, [rules, callsLogged, callsTarget, isSunday])

  const done = items.filter((i) => i.checked).length

  return (
    <TrackerCard
      title="Non-negotiables"
      action={
        <span className="font-mono text-[11px] text-muted-foreground">
          {done}/{items.length}
        </span>
      }
    >
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            {/* div, not button: the Checkbox inside already renders a <button> */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleRule(date, item.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleRule(date, item.key)
                }
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-1 py-2 text-left"
            >
              <Checkbox checked={item.checked} className="pointer-events-none" />
              <item.icon className="size-4 shrink-0" style={{ color: item.color }} />
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm',
                  item.checked && 'text-muted-foreground line-through',
                )}
              >
                {item.label}
              </span>
              {item.sub && (
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {item.sub}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </TrackerCard>
  )
}
