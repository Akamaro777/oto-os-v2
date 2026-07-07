import { useState } from 'react'
import { Plus, Trash2, Dumbbell } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { DayStepper } from '@/components/DayStepper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LineTrend, BarTotals } from '@/components/charts'
import { todayISO } from '@/lib/dates'
import { PILLAR_META } from '@/lib/pillars'
import { getProfileNumber } from '@/store/profile'
import { YearHeatmap } from '@/components/YearHeatmap'
import {
  useBodyLog,
  setBodyNumber,
  useBodySeries,
  useMealsByDate,
  deleteMeal,
  mealTotals,
  useGymTotals,
  useBodyActivityMap,
} from '@/store/body'
import { MealLoggerDialog } from './MealLoggerDialog'
import { TrainingGrid } from './TrainingGrid'

const BODY = PILLAR_META.body.color

export function BodyTracker() {
  const [date, setDate] = useState(todayISO())
  const [mealOpen, setMealOpen] = useState(false)

  const log = useBodyLog(date)
  const meals = useMealsByDate(date)
  const weightSeries = useBodySeries('weight')
  const sleepSeries = useBodySeries('sleep')
  const gymTotals = useGymTotals()
  const activityMap = useBodyActivityMap()

  const totals = mealTotals(meals)
  const calTarget = getProfileNumber('calTarget')
  const protTarget = getProfileNumber('protTarget')

  return (
    <div className="space-y-4">
      <DayStepper date={date} onChange={setDate} />

      {/* Daily weight + sleep */}
      <TrackerCard title="Daily log">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            id="body-weight"
            label="Weight (kg)"
            value={log?.weight}
            onCommit={(v) => setBodyNumber(date, 'weight', v)}
          />
          <NumberField
            id="body-sleep"
            label="Sleep (h)"
            value={log?.sleep}
            onCommit={(v) => setBodyNumber(date, 'sleep', v)}
          />
        </div>
      </TrackerCard>

      {/* Meals */}
      <TrackerCard
        title="Meals"
        action={
          <Button size="sm" variant="secondary" onClick={() => setMealOpen(true)}>
            <Plus className="size-4" /> Log meal
          </Button>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-3">
          <MacroBar label="Calories" value={totals.cal} target={calTarget} unit="kcal" color={BODY} />
          <MacroBar label="Protein" value={totals.prot} target={protTarget} unit="g" color="#7dd3fc" />
        </div>
        {meals.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No meals logged for this day.</p>
        ) : (
          <ul className="divide-y divide-border">
            {meals.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{m.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {m.cal} kcal · {m.prot}g protein
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMeal(m.id)}
                  aria-label="Delete meal"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </TrackerCard>

      {/* Training */}
      <TrackerCard title="This week's training">
        <TrainingGrid />
      </TrackerCard>

      <TrackerCard title="Consistency">
        <YearHeatmap data={activityMap} color={BODY} />
      </TrackerCard>

      {/* Charts */}
      <TrackerCard title="Weight — all time">
        <LineTrend data={weightSeries} color={BODY} unit="kg" />
      </TrackerCard>

      <TrackerCard title="Sleep — all time">
        <LineTrend data={sleepSeries} color="#a78bfa" unit="h" />
      </TrackerCard>

      <TrackerCard title="Training totals">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Dumbbell className="size-3.5" /> all sessions logged
        </div>
        <BarTotals data={gymTotals} color={BODY} />
      </TrackerCard>

      <MealLoggerDialog open={mealOpen} onOpenChange={setMealOpen} date={date} />
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onCommit,
}: {
  id: string
  label: string
  value?: number
  onCommit: (v: string) => void
}) {
  // type="text" (not "number") so EU keyboards' comma decimals are accepted;
  // the store normalises ',' → '.' on commit.
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={value ?? ''}
        key={`${id}-${value ?? ''}`}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder="—"
      />
    </div>
  )
}

function MacroBar({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string
  value: number
  target: number
  unit: string
  color: string
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground">{value}</span>/{target}
          {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
