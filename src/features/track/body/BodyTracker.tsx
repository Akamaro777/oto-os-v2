
import { Dumbbell } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { DayStepper } from '@/components/DayStepper'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LineTrend, BarTotals } from '@/components/charts'
import { useSelectedDate } from '@/lib/useToday'
import { PILLAR_META } from '@/lib/pillars'
import { YearHeatmap } from '@/components/YearHeatmap'
import {
  useBodyLog,
  setBodyNumber,
  useBodySeries,
  useGymTotals,
  useBodyActivityMap,
} from '@/store/body'
import { TrainingGrid } from './TrainingGrid'

const BODY = PILLAR_META.body.color

export function BodyTracker() {
  const [date, setDate] = useSelectedDate()

  const log = useBodyLog(date)
  const weightSeries = useBodySeries('weight')
  const sleepSeries = useBodySeries('sleep')
  const gymTotals = useGymTotals()
  const activityMap = useBodyActivityMap()

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
