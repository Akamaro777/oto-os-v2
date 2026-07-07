import { useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ProgressRing } from '@/components/ProgressRing'
import { CountUp } from '@/components/CountUp'
import { LineTrend } from '@/components/charts'
import { pillarColor } from '@/lib/pillars'
import { type NorthStar, type GoalStatus } from '@/store/northStars'
import { useBodySeries } from '@/store/body'
import { usePortfolioDailySeries } from '@/store/portfolio'
import { useBusinessHoursMap, useBusinessCumulative } from '@/store/business'
import { useMockExams } from '@/store/study'

const STATUS_COLOR: Record<GoalStatus, string> = {
  complete: '#c9f158',
  ahead: '#c9f158',
  ontrack: '#8a8f98',
  behind: '#fbbf24',
  danger: '#f36a5a',
}

interface GoalDetailSheetProps {
  star: NorthStar | null
  onClose: () => void
}

/** Full "story" view for a North Star: big ring, the numbers, required rate, history chart. */
export function GoalDetailSheet({ star, onClose }: GoalDetailSheetProps) {
  const weight = useBodySeries('weight')
  const portfolio = usePortfolioDailySeries()
  const bizMap = useBusinessHoursMap()
  const cumulative = useBusinessCumulative()
  const mocks = useMockExams()

  const series = useMemo(() => {
    if (!star) return []
    switch (star.id) {
      case 'bulk':
      case 'cut':
        return weight
      case 'money':
        return portfolio
      case 'business': {
        // cumulative hours since the goal start
        const dates = Object.keys(bizMap)
          .filter((d) => !cumulative.start || d >= cumulative.start)
          .sort()
        let sum = 0
        return dates.map((date) => {
          sum += bizMap[date]
          return { date, value: Math.round(sum * 10) / 10 }
        })
      }
      case 'gmat':
        return mocks.map((m) => ({ date: m.date, value: m.score }))
      default:
        return []
    }
  }, [star, weight, portfolio, bizMap, cumulative.start, mocks])

  const rate = useMemo(() => {
    if (!star || star.daysLeft <= 0) return null
    const gap = star.targetValue - star.currentValue
    switch (star.id) {
      case 'cut': {
        const toLose = star.currentValue - star.targetValue
        if (toLose <= 0) return 'target reached'
        return `lose ${((toLose / star.daysLeft) * 7).toFixed(2)}kg/week`
      }
      case 'bulk': {
        if (gap <= 0) return 'target reached'
        return `gain ${((gap / star.daysLeft) * 7).toFixed(2)}kg/week`
      }
      case 'money':
        if (gap <= 0) return 'target reached'
        return `+€${Math.ceil(gap / star.daysLeft).toLocaleString('en-US')}/day`
      case 'business':
        if (gap <= 0) return 'target reached'
        return `${(gap / star.daysLeft).toFixed(1)}h/day needed`
      case 'gmat':
        if (gap <= 0) return 'target reached'
        return `${Math.round(gap)} points to go`
      default:
        return null
    }
  }, [star])

  if (!star) return null
  const color = pillarColor(star.pillar)

  return (
    <Sheet open={star != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="glass-heavy mx-auto max-w-md gap-5 rounded-t-3xl border-0 px-5 pb-10">
        <SheetHeader className="px-0">
          <SheetTitle className="font-serif text-2xl">{star.label}</SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-5">
          <ProgressRing pct={star.pct} markerPct={star.expectedPct} color={color} size={110} stroke={8}>
            <span className="font-serif text-2xl">
              <CountUp value={star.pct} format={(v) => `${Math.round(v)}%`} />
            </span>
          </ProgressRing>
          <div className="flex-1 space-y-1.5">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ color: STATUS_COLOR[star.status] }}
            >
              {star.statusText}
            </p>
            <p className="font-serif text-3xl" style={{ color, textShadow: `0 0 24px ${color}44` }}>
              {star.current}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {star.pace} · {star.meta}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Target" value={fmtTarget(star)} />
          <Stat label="Days left" value={String(star.daysLeft)} />
          <Stat label="To stay on it" value={rate ?? '—'} highlight={color} />
        </div>

        <div className="glass rounded-2xl p-4">
          <h3 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            History
          </h3>
          <LineTrend data={series} color={color} target={star.targetValue || undefined} height={170} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function fmtTarget(star: NorthStar): string {
  switch (star.id) {
    case 'bulk':
    case 'cut':
      return `${star.targetValue}kg`
    case 'money':
      return `€${star.targetValue.toLocaleString('en-US')}`
    case 'business':
      return `${star.targetValue}h`
    default:
      return String(star.targetValue)
  }
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="glass rounded-xl px-2 py-3 text-center">
      <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-[13px] font-medium leading-tight"
        style={highlight ? { color: highlight } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
