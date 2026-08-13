import { useEffect, useState } from 'react'
import { Minus, Plus, Trash2, Lightbulb, Phone, Square } from 'lucide-react'
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
import { CountUp } from '@/components/CountUp'
import { PILLAR_META } from '@/lib/pillars'

import { useSelectedDate } from '@/lib/useToday'
import { getProfileNumber } from '@/store/profile'
import { YearHeatmap } from '@/components/YearHeatmap'
import { useIdeas, addIdea, deleteIdea } from '@/store/business'
import { useCvLog, setColdCalls, useColdCallsSeries, useColdCallsMap } from '@/store/study'
import { RevenueCard } from './RevenueCard'
import { toast } from 'sonner'

const MONEY = PILLAR_META.money.color

/** Business = cold-call execution: today's count, the 7-day trend, consistency, ideas. */
export function BusinessTracker() {
  const [date, setDate] = useSelectedDate()
  const [ideaOpen, setIdeaOpen] = useState(false)

  const callsTarget = getProfileNumber('callsDailyTarget') || 70
  const calls = useCvLog(date)?.calls ?? 0
  const callsSeries = useColdCallsSeries(7)
  const callsMap = useColdCallsMap()
  const ideas = useIdeas()

  return (
    <div className="space-y-4">
      <DayStepper date={date} onChange={setDate} />

      <RevenueCard />

      <TrackerCard title="Cold calls">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-serif text-4xl" style={{ color: MONEY, textShadow: `0 0 24px ${MONEY}44` }}>
              <CountUp value={calls} format={(v) => String(Math.round(v))} />
            </span>
            <span className="font-mono text-sm text-muted-foreground"> / {callsTarget} today</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease calls"
              onClick={() => setColdCalls(date, calls - 1)}
              className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Add 1 call"
              onClick={() => setColdCalls(date, calls + 1)}
              className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Add 10 calls"
              onClick={() => setColdCalls(date, calls + 10)}
              className="flex h-9 items-center justify-center rounded-full bg-secondary px-3 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              +10
            </button>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${Math.min(100, (calls / callsTarget) * 100)}%`, backgroundColor: MONEY }}
          />
        </div>
      </TrackerCard>

      <CallSessionCard date={date} calls={calls} />

      <TrackerCard title="Cold calls — last 7 days">
        <LineTrend data={callsSeries} color={MONEY} unit="" target={callsTarget} height={150} />
      </TrackerCard>

      <TrackerCard title="Consistency">
        <YearHeatmap data={callsMap} color={MONEY} />
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

      <IdeaDialog open={ideaOpen} onOpenChange={setIdeaOpen} />
    </div>
  )
}

const SESSION_KEY = 'oto-call-session'

interface CallSession {
  startTs: number
  startCount: number
}

/**
 * Call-session timer: start a block, tap per dial, see calls/hour live.
 * Each tap writes straight to the day's count (no data to lose if the app
 * dies); the session itself is just a start marker in localStorage, so it
 * survives backgrounding.
 */
function CallSessionCard({ date, calls }: { date: string; calls: number }) {
  const [session, setSession] = useState<CallSession | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as CallSession | null
    } catch {
      return null
    }
  })
  const [, tick] = useState(0)

  // Live clock while a session runs.
  useEffect(() => {
    if (!session) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [session])

  function start() {
    const s = { startTs: Date.now(), startCount: calls }
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
  }

  function end() {
    localStorage.removeItem(SESSION_KEY)
    if (session) {
      const made = calls - session.startCount
      const mins = Math.max(1, Math.round((Date.now() - session.startTs) / 60_000))
      toast.success(
        made > 0
          ? `Session done: ${made} calls in ${mins}m — ${Math.round((made / mins) * 60)}/hour`
          : `Session ended after ${mins}m`,
      )
    }
    setSession(null)
  }

  if (!session) {
    return (
      <button
        type="button"
        onClick={start}
        className="glass edge-light pressable flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium"
        style={{ color: MONEY }}
      >
        <Phone className="size-4" /> Start a call session
      </button>
    )
  }

  const elapsed = Math.max(0, Date.now() - session.startTs)
  const mm = String(Math.floor(elapsed / 60_000)).padStart(2, '0')
  const ss = String(Math.floor((elapsed % 60_000) / 1000)).padStart(2, '0')
  const made = Math.max(0, calls - session.startCount)
  const perHour = elapsed > 60_000 ? Math.round((made / (elapsed / 3_600_000)) * 1) : null

  return (
    <TrackerCard
      title="Call session"
      action={
        <button
          type="button"
          onClick={end}
          className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground"
        >
          <Square className="size-3 fill-current" /> End
        </button>
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-2xl tabular-nums" style={{ color: MONEY }}>
            {mm}:{ss}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {made} call{made === 1 ? '' : 's'}
            {perHour != null && ` · ${perHour}/hour`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setColdCalls(date, calls + 1)}
          className="pressable flex size-16 items-center justify-center rounded-full text-2xl font-semibold text-background"
          style={{ backgroundColor: MONEY, boxShadow: `0 0 20px ${MONEY}66` }}
          aria-label="Log one call"
        >
          +1
        </button>
      </div>
    </TrackerCard>
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
