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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PILLARS, type Block } from '@/store/schema'
import { PILLAR_META } from '@/lib/pillars'
import { createBlock, updateBlock, deleteBlock } from '@/store/planner'
import { useAllTasks } from '@/store/tasks'
import { toast } from 'sonner'

interface BlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  /** Set when editing an existing block. */
  block?: Block
  /** Start time to pre-fill for new blocks (from a tapped slot). */
  defaultStart?: string
}

const NONE = '__none__'

export function BlockDialog({ open, onOpenChange, date, block, defaultStart }: BlockDialogProps) {
  const isEdit = block != null
  const tasks = useAllTasks()
  const openTasks = tasks.filter((t) => !t.done)

  const [title, setTitle] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('')
  const [category, setCategory] = useState('personal')
  const [taskId, setTaskId] = useState(NONE)

  useEffect(() => {
    if (!open) return
    setTitle(block?.title ?? '')
    setStart(block?.start ?? defaultStart ?? '09:00')
    setEnd(block?.end ?? '')
    setCategory(block?.category ?? 'personal')
    setTaskId(block?.taskId ?? NONE)
  }, [open, block, defaultStart])

  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) {
      toast.error('Give the block a title')
      return
    }
    if (end && end <= start) {
      toast.error('End must be after start')
      return
    }
    const fields = {
      title: trimmed,
      start,
      end,
      category,
      taskId: taskId === NONE ? '' : taskId,
    }
    if (isEdit) {
      updateBlock(block.id, fields)
      toast.success('Block saved')
    } else {
      createBlock(date, fields)
      toast.success('Block added')
    }
    onOpenChange(false)
  }

  function handleDelete() {
    if (!block) return
    deleteBlock(block.id)
    toast('Block deleted')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? 'Edit block' : 'New block'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="block-title">What</Label>
            <Input
              id="block-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deep work"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="block-start">Start</Label>
              <Input
                id="block-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="block-end">End</Label>
              <Input
                id="block-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
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

          <div className="space-y-1.5">
            <Label>Link task</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— none —</SelectItem>
                {openTasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {isEdit ? (
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Delete block">
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
