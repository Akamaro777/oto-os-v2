import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Mic, Sparkles, Loader2 } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { VoiceDialog } from '@/components/VoiceDialog'
import { cn } from '@/lib/utils'
import { todayISO, tomorrowISO, addDaysISO, dayHeaderLabel } from '@/lib/dates'
import { captureDayPlan, autoPlanDay } from '@/lib/aiCapture'
import { AnthropicError } from '@/lib/anthropic'
import { toast } from 'sonner'
import { type Block } from '@/store/schema'
import { DayTimeline } from './DayTimeline'
import { Top3Card } from './Top3Card'
import { BlockDialog } from './BlockDialog'
import { TasksView } from '@/features/tasks/TasksView'

type PlanTab = 'timeline' | 'tasks'

export function PlanScreen() {
  const [date, setDate] = useState(todayISO())
  const [view, setView] = useState<PlanTab>('timeline')

  // Block dialog state
  const [blockOpen, setBlockOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<Block | undefined>(undefined)
  const [defaultStart, setDefaultStart] = useState<string | undefined>(undefined)

  // Task create dialog (owned here so the header + button drives it)
  const [taskCreateOpen, setTaskCreateOpen] = useState(false)
  // Voice day-planning
  const [voiceOpen, setVoiceOpen] = useState(false)
  // One-tap agentic planning
  const [planning, setPlanning] = useState(false)

  async function handleAutoPlan() {
    if (planning) return
    setPlanning(true)
    try {
      const summary = await autoPlanDay(date)
      toast.success(summary)
    } catch (err) {
      toast.error(err instanceof AnthropicError ? err.message : 'Auto-plan failed')
    } finally {
      setPlanning(false)
    }
  }

  function openNewBlock(startHM: string) {
    setEditingBlock(undefined)
    setDefaultStart(startHM)
    setBlockOpen(true)
  }
  function openEditBlock(block: Block) {
    setEditingBlock(block)
    setDefaultStart(undefined)
    setBlockOpen(true)
  }

  function handleAdd() {
    if (view === 'timeline') openNewBlock('09:00')
    else setTaskCreateOpen(true)
  }

  return (
    <Screen
      title="Plan"
      subtitle={view === 'timeline' ? dayHeaderLabel(date) : 'everything on your plate'}
      action={
        <div className="flex gap-2">
          <Button
            size="icon"
            className="glow-primary rounded-full"
            onClick={() => setVoiceOpen(true)}
            aria-label="Plan by voice"
          >
            <Mic className="size-5" />
          </Button>
          <Button size="icon" variant="secondary" className="rounded-full" onClick={handleAdd}>
            <Plus className="size-5" />
          </Button>
        </div>
      }
    >
      {/* View switch */}
      <div className="mb-4 flex gap-1 rounded-lg bg-secondary p-1">
        {(['timeline', 'tasks'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors',
              view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'timeline' ? (
        <div className="space-y-4">
          {/* Day navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDate(addDaysISO(date, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div className="flex gap-1.5">
              <DayChip label="Today" active={date === todayISO()} onClick={() => setDate(todayISO())} />
              <DayChip
                label="Tomorrow"
                active={date === tomorrowISO()}
                onClick={() => setDate(tomorrowISO())}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDate(addDaysISO(date, 1))}
              aria-label="Next day"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>

          <button
            type="button"
            onClick={handleAutoPlan}
            disabled={planning}
            className="glass edge-light pressable flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-primary transition-opacity disabled:opacity-60"
          >
            {planning ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Building your day…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Plan my day for me
              </>
            )}
          </button>

          <Top3Card date={date} />

          <DayTimeline date={date} onNewBlock={openNewBlock} onEditBlock={openEditBlock} />

          <BlockDialog
            open={blockOpen}
            onOpenChange={setBlockOpen}
            date={date}
            block={editingBlock}
            defaultStart={defaultStart}
          />
        </div>
      ) : (
        <TasksView createOpen={taskCreateOpen} onCreateOpenChange={setTaskCreateOpen} />
      )}

      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        title="Plan your day"
        hint={`Tell me about ${dayHeaderLabel(date).toLowerCase()} — priorities, time blocks, to-dos`}
        placeholder="e.g. Gym at 8, GMAT deep work from 9 to 12, PwC in the afternoon, call mom, top priority is finishing the quant set…"
        process={(text) => captureDayPlan(text, date)}
      />
    </Screen>
  )
}

function DayChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 font-mono text-xs transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}
