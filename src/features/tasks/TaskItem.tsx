import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { type Task } from '@/store/schema'
import { toggleTask } from '@/store/tasks'
import { pillarColor, resolvePillar, PILLAR_META } from '@/lib/pillars'
import { relativeDueLabel } from '@/lib/dates'

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  high: '#ef4444',
  med: '#fbbf24',
  low: '#8b8d95',
}

interface TaskItemProps {
  task: Task
  onEdit: (task: Task) => void
}

export function TaskItem({ task, onEdit }: TaskItemProps) {
  const overdue = !task.done && task.due != null && task.due < new Date().toISOString().slice(0, 10)

  return (
    <div className="flex items-start gap-3 py-3">
      <Checkbox
        checked={task.done}
        onCheckedChange={() => toggleTask(task.id)}
        className="mt-0.5"
        aria-label={task.done ? 'Mark not done' : 'Mark done'}
      />
      <button
        type="button"
        onClick={() => onEdit(task)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={cn(
            'text-sm leading-snug',
            task.done && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
            />
            {task.priority}
          </span>
          {task.category && (
            <span className="inline-flex items-center gap-1">
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: pillarColor(task.category) }}
              />
              {PILLAR_META[resolvePillar(task.category)].label}
            </span>
          )}
          {task.due && (
            <span className={cn(overdue && 'text-destructive')}>
              {relativeDueLabel(task.due)}
            </span>
          )}
        </div>
      </button>
    </div>
  )
}
