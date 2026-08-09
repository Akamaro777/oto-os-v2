import { useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { DayStepper } from '@/components/DayStepper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { LineTrend } from '@/components/charts'
import { CountUp } from '@/components/CountUp'
import { PILLAR_META } from '@/lib/pillars'
import { todayISO, shortDate } from '@/lib/dates'
import { getProfileNumber } from '@/store/profile'
import { YearHeatmap } from '@/components/YearHeatmap'
import {
  useCvLog,
  setStudyHours,
  setPracticeNumber,
  setPracticeTopic,
  useStudySeries,
  useStudyHoursMap,
  useMockExams,
  addMockExam,
  deleteMockExam,
} from '@/store/study'
import { GmatCountdownCard, ExamProfileCard, WeakSpotsCard, GmatPhotoButton } from './GmatCards'
import { toast } from 'sonner'

const CV = PILLAR_META.cv.color

export function StudyTracker() {
  const [date, setDate] = useState(todayISO())
  const [mockOpen, setMockOpen] = useState(false)

  const log = useCvLog(date)
  const series = useStudySeries(7)
  const hoursMap = useStudyHoursMap()
  const mocks = useMockExams()

  const dailyTarget = getProfileNumber('studyTarget')
  const scoreTarget = getProfileNumber('gmatTargetScore')
  const hours = log?.studyHours ?? 0
  const accuracy =
    log?.problems && log.problems > 0 && log.correct != null
      ? Math.round((log.correct / log.problems) * 100)
      : null

  const mockSeries = mocks.map((m) => ({ date: m.date, value: m.score }))

  return (
    <div className="space-y-4">
      <DayStepper date={date} onChange={setDate} />

      <GmatCountdownCard />

      <ExamProfileCard />

      <WeakSpotsCard />

      <TrackerCard title="Study hours">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-serif text-4xl" style={{ color: CV, textShadow: `0 0 24px ${CV}44` }}>
              <CountUp value={hours} format={(v) => (Math.round(v * 2) / 2).toString()} />
            </span>
            <span className="font-mono text-sm text-muted-foreground"> h · target {dailyTarget}/day</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease"
              onClick={() => setStudyHours(date, hours - 0.5)}
              className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Increase"
              onClick={() => setStudyHours(date, hours + 0.5)}
              className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </TrackerCard>

      <TrackerCard title="Practice set" action={<GmatPhotoButton date={date} />}>
        <div className="grid grid-cols-3 gap-3">
          <PracticeField
            id="pr-problems"
            label="Problems"
            value={log?.problems}
            onCommit={(v) => setPracticeNumber(date, 'problems', v)}
          />
          <PracticeField
            id="pr-correct"
            label="Correct"
            value={log?.correct}
            onCommit={(v) => setPracticeNumber(date, 'correct', v)}
          />
          <PracticeField
            id="pr-time"
            label="Time (min)"
            value={log?.time}
            onCommit={(v) => setPracticeNumber(date, 'time', v)}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="pr-topic">Topic</Label>
            <Input
              id="pr-topic"
              defaultValue={log?.topic ?? ''}
              key={`${date}-${log?.topic ?? ''}`}
              onBlur={(e) => setPracticeTopic(date, e.target.value)}
              placeholder="e.g. Quant"
            />
          </div>
          {accuracy != null && (
            <div className="text-right">
              <p className="font-serif text-2xl" style={{ color: CV }}>
                {accuracy}%
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">accuracy</p>
            </div>
          )}
        </div>
      </TrackerCard>

      <TrackerCard title="Study hours — last 7 days">
        <LineTrend data={series} color={CV} unit="h" target={dailyTarget} height={150} />
      </TrackerCard>

      <TrackerCard title="Consistency">
        <YearHeatmap data={hoursMap} color={CV} />
      </TrackerCard>

      <TrackerCard
        title="Mock exams"
        action={
          <Button size="sm" variant="secondary" onClick={() => setMockOpen(true)}>
            <Plus className="size-4" /> Mock
          </Button>
        }
      >
        <LineTrend data={mockSeries} color={CV} unit="" target={scoreTarget} height={160} />
        {mocks.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {[...mocks].reverse().map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums">{m.score}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{shortDate(m.date)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMockExam(m.id)}
                  aria-label="Delete mock"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </TrackerCard>

      <MockDialog open={mockOpen} onOpenChange={setMockOpen} />
    </div>
  )
}

function PracticeField({
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
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px]">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        defaultValue={value ?? ''}
        key={`${id}-${value ?? ''}`}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder="—"
      />
    </div>
  )
}

function MockDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [date, setDate] = useState(todayISO())
  const [score, setScore] = useState('')

  function handleAdd() {
    const s = Number(score)
    if (!s) {
      toast.error('Enter a score')
      return
    }
    addMockExam(date || todayISO(), s)
    toast.success('Mock added')
    setScore('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add mock exam</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mock-score">Score</Label>
            <Input
              id="mock-score"
              type="number"
              inputMode="numeric"
              autoFocus
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 680"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mock-date">Date</Label>
            <Input id="mock-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={handleAdd}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
