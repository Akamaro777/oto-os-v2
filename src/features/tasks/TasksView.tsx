import { useMemo, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { EmptyState } from '@/components/Screen'
import { cn } from '@/lib/utils'
import { type Task } from '@/store/schema'
import {
  useAllTasks,
  filterTasks,
  sortTasks,
  countOpenByFilter,
  type TaskFilter,
} from '@/store/tasks'
import { TaskItem } from './TaskItem'
import { TaskDialog } from './TaskDialog'

const FILTERS: { id: TaskFilter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'today', label: 'Today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'done', label: 'Done' },
]

interface TasksViewProps {
  /** Controls the create dialog from a parent (e.g. a header + button). */
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

export function TasksView({ createOpen, onCreateOpenChange }: TasksViewProps) {
  const tasks = useAllTasks()
  const [filter, setFilter] = useState<TaskFilter>('open')
  // Separate open flag: clearing the task on close would flip the dialog to
  // "New task" mode for the duration of its exit animation.
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Task | undefined>(undefined)

  const counts = useMemo(() => countOpenByFilter(tasks), [tasks])
  const visible = useMemo(
    () => sortTasks(filterTasks(tasks, filter)),
    [tasks, filter],
  )

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = f.id === filter
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span className={cn('tabular-nums', active ? 'opacity-70' : 'opacity-50')}>
                {counts[f.id]}
              </span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-8" />}
          message={
            filter === 'done'
              ? 'Nothing completed yet.'
              : filter === 'open'
                ? 'No open tasks. Add one with the + button.'
                : `No ${filter} tasks.`
          }
        />
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {visible.map((task) => (
            <li key={task.id}>
              <TaskItem
                task={task}
                onEdit={(t) => {
                  setEditing(t)
                  setEditOpen(true)
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Create */}
      <TaskDialog open={createOpen} onOpenChange={onCreateOpenChange} />
      {/* Edit */}
      <TaskDialog open={editOpen} onOpenChange={setEditOpen} task={editing} />
    </div>
  )
}
