import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { todayISO, tomorrowISO, addDaysISO, dayHeaderLabel } from '@/lib/dates'
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
        <Button size="icon" className="rounded-full" onClick={handleAdd}>
          <Plus className="size-5" />
        </Button>
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
