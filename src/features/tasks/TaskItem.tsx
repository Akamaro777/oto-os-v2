import { useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'motion/react'
import { Check, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { celebrate, celebrateFromEvent } from '@/lib/celebrate'
import { type Task } from '@/store/schema'
import { toggleTask, deleteTask, restoreTask } from '@/store/tasks'
import { pillarColor, resolvePillar, PILLAR_META } from '@/lib/pillars'
import { relativeDueLabel, todayISO } from '@/lib/dates'
import { toast } from 'sonner'

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  high: '#f36a5a',
  med: '#fbbf24',
  low: '#8a8f98',
}

const SWIPE_THRESHOLD = 90

interface TaskItemProps {
  task: Task
  onEdit: (task: Task) => void
}

/** Task row with swipe gestures: right → complete, left → delete. */
export function TaskItem({ task, onEdit }: TaskItemProps) {
  // Local date, not UTC — right after midnight the two disagree.
  const overdue = !task.done && task.due != null && task.due < todayISO()
  const x = useMotionValue(0)
  const rightOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  const leftOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])
  const rowRef = useRef<HTMLDivElement>(null)
  // Suppress the tap that fires on release after a horizontal drag
  const dragging = useRef(false)

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    setTimeout(() => (dragging.current = false), 80)
    if (info.offset.x > SWIPE_THRESHOLD) {
      if (!task.done) {
        const r = rowRef.current?.getBoundingClientRect()
        celebrate(r ? r.left + 40 : undefined, r ? r.top + r.height / 2 : undefined)
      }
      toggleTask(task.id)
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      // A 90px swipe is easy to hit by accident — deletion must be undoable.
      const snapshot = { ...task }
      deleteTask(task.id)
      toast('Task deleted', {
        action: { label: 'Undo', onClick: () => restoreTask(snapshot) },
      })
    }
  }

  return (
    <div ref={rowRef} className="relative overflow-hidden rounded-lg">
      {/* Swipe action backdrops */}
      <motion.div
        aria-hidden
        style={{ opacity: rightOpacity }}
        className="absolute inset-y-0 left-0 flex w-24 items-center justify-start rounded-l-lg bg-primary/20 pl-3 text-primary"
      >
        <Check className="size-5" strokeWidth={2.5} />
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: leftOpacity }}
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-end rounded-r-lg bg-destructive/20 pr-3 text-destructive"
      >
        <Trash2 className="size-5" />
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.45, right: 0.45 }}
        onDragStart={() => (dragging.current = true)}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative flex touch-pan-y items-start gap-3 bg-transparent py-3"
      >
        <Checkbox
          checked={task.done}
          onCheckedChange={() => !dragging.current && toggleTask(task.id)}
          onClick={(e) => !dragging.current && !task.done && celebrateFromEvent(e)}
          className="mt-0.5"
          aria-label={task.done ? 'Mark not done' : 'Mark done'}
        />
        <button
          type="button"
          onClick={() => !dragging.current && onEdit(task)}
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
      </motion.div>
    </div>
  )
}
