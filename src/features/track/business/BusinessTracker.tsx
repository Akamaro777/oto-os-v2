import { useState } from 'react'
import { Minus, Plus, Trash2, Lightbulb } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { DayStepper } from '@/components/DayStepper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { LineTrend } from '@/components/charts'
import { PILLAR_META } from '@/lib/pillars'
import { todayISO, tomorrowISO, dayHeaderLabel, daysBetween } from '@/lib/dates'
import { getProfileNumber } from '@/store/profile'
import {
  useBusinessHours,
  setBusinessHours,
  useBusinessSeries,
  useBusinessCumulative,
  useIdeas,
  addIdea,
  deleteIdea,
  useBusinessPlan,
  setBusinessPlan,
} from '@/store/business'
import { toast } from 'sonner'

const MONEY = PILLAR_META.money.color

export function BusinessTracker() {
  const [date, setDate] = useState(todayISO())
  const [ideaOpen, setIdeaOpen] = useState(false)

  const hours = useBusinessHours(date)
  const series = useBusinessSeries(7)
  const cumulative = useBusinessCumulative()
  const ideas = useIdeas()

  const dailyTarget = getProfileNumber('bizTarget')
  const tomorrow = tomorrowISO()
  const plan = useBusinessPlan(tomorrow)

  // On-pace maths
  const totalDays = Math.max(1, daysBetween(cumulative.start, cumulative.end))
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(cumulative.start, todayISO())))
  const expected = (cumulative.target / totalDays) * elapsed
  const delta = cumulative.logged - expected
  const pct = cumulative.target > 0 ? Math.min(100, (cumulative.logged / cumulative.target) * 100) : 0

  return (
    <div className="space-y-4">
      <DayStepper date={date} onChange={setDate} />

      <TrackerCard title="Hours worked">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-serif text-4xl" style={{ color: MONEY }}>
              {hours}
            </span>
            <span className="font-mono text-sm text-muted-foreground"> h · target {dailyTarget}/day</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease"
              onClick={() => setBusinessHours(date, hours - 0.5)}
              className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Increase"
              onClick={() => setBusinessHours(date, hours + 0.5)}
              className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </TrackerCard>

      <TrackerCard title="Cumulative goal">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-sm">
            <span className="text-foreground text-lg">{cumulative.logged}</span>
            <span className="text-muted-foreground"> / {cumulative.target} h</span>
          </span>
          <span
            className="font-mono text-xs"
            style={{ color: delta >= 0 ? MONEY : '#ef4444' }}
          >
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)} h vs pace
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: MONEY }} />
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {cumulative.start} → {cumulative.end} · {Math.max(0, totalDays - elapsed)} days left
        </p>
      </TrackerCard>

      <TrackerCard title="Hours — last 7 days">
        <LineTrend data={series} color={MONEY} unit="h" target={dailyTarget} height={150} />
      </TrackerCard>

      <TrackerCard
        title="Ideas bank"
        action={
          <Button size="sm" variant="secondary" onClick={() => setIdeaOpen(true)}>
            <Plus className="size-4" /> Idea
          </Button>
        }
      >
        {ideas.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No ideas captured yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {ideas.map((idea) => (
              <li key={idea.id} className="flex items-start gap-2 py-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{idea.title}</p>
                  {idea.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{idea.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteIdea(idea.id)}
                  aria-label="Delete idea"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </TrackerCard>

      <TrackerCard title={`Plan for ${dayHeaderLabel(tomorrow).toLowerCase()}`}>
        <PlanField date={tomorrow} value={plan} />
      </TrackerCard>

      <IdeaDialog open={ideaOpen} onOpenChange={setIdeaOpen} />
    </div>
  )
}

function PlanField({ date, value }: { date: string; value: string }) {
  const [text, setText] = useState(value)
  return (
    <Textarea
      defaultValue={value}
      key={`${date}-${value}`}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && setBusinessPlan(date, text)}
      placeholder="The plan for tomorrow…"
      rows={3}
    />
  )
}

function IdeaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  function handleAdd() {
    if (!title.trim()) {
      toast.error('Enter an idea')
      return
    }
    addIdea(title, notes)
    toast.success('Idea captured')
    setTitle('')
    setNotes('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">New idea</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="idea-title">Idea</Label>
            <Input
              id="idea-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="One-line idea"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-notes">Notes</Label>
            <Textarea
              id="idea-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional detail…"
              rows={3}
            />
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
