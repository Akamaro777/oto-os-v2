import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PILLARS, PRIORITIES, type Priority, type Task } from '@/store/schema'
import { PILLAR_META } from '@/lib/pillars'
import { createTask, updateTask, deleteTask } from '@/store/tasks'
import { useAllProjects } from '@/store/projects'
import { toast } from 'sonner'

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this task; otherwise it creates a new one. */
  task?: Task
  /** Pre-fill the due date for new tasks (e.g. from the planner). */
  defaultDue?: string
}

const NONE = '__none__'

export function TaskDialog({ open, onOpenChange, task, defaultDue }: TaskDialogProps) {
  const isEdit = task != null
  const projects = useAllProjects()
  const activeProjects = projects.filter((p) => !p.archived)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<Priority>('med')
  const [due, setDue] = useState('')
  const [category, setCategory] = useState<string>(NONE)
  const [projectId, setProjectId] = useState<string>(NONE)

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setNotes(task?.notes ?? '')
    setPriority(task?.priority ?? 'med')
    setDue(task?.due ?? defaultDue ?? '')
    setCategory(task?.category ?? NONE)
    setProjectId(task?.projectId ?? NONE)
  }, [open, task, defaultDue])

  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) {
      toast.error('Give the task a title')
      return
    }
    const fields = {
      title: trimmed,
      notes,
      priority,
      due,
      category: category === NONE ? '' : category,
      projectId: projectId === NONE ? '' : projectId,
    }
    if (isEdit) {
      updateTask(task.id, fields)
      toast.success('Task updated')
    } else {
      createTask(fields)
      toast.success('Task added')
    }
    onOpenChange(false)
  }

  function handleDelete() {
    if (!task) return
    deleteTask(task.id)
    toast('Task deleted')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? 'Edit task' : 'New task'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSave()
                }
              }}
              placeholder="What needs doing?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due</Label>
              <Input
                id="task-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Pillar</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {PILLARS.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span
                      className="mr-2 inline-block size-2 rounded-full align-middle"
                      style={{ backgroundColor: PILLAR_META[p].color }}
                    />
                    {PILLAR_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeProjects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— none —</SelectItem>
                  {activeProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {isEdit ? (
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Delete task">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{isEdit ? 'Save' : 'Add'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
