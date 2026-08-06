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
import { type CalendarEvent } from '@/store/schema'
import { createEvent, updateEvent, deleteEvent } from '@/store/events'
import { pillarColor } from '@/lib/pillars'
import { toast } from 'sonner'

const CATEGORIES = ['personal', 'body', 'social', 'money', 'study'] as const

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected date for new events. */
  defaultDate: string
  event?: CalendarEvent
}

export function EventDialog({ open, onOpenChange, defaultDate, event }: EventDialogProps) {
  const isEdit = event != null
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [category, setCategory] = useState<string>('personal')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(event?.title ?? '')
    setDate(event?.date ?? defaultDate)
    setTime(event?.time ?? '')
    setCategory(event?.category ?? 'personal')
    setNotes(event?.notes ?? '')
  }, [open, event, defaultDate])

  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed || !date) {
      toast.error('Give the event a title and date')
      return
    }
    const fields = { title: trimmed, date, time, category, notes }
    if (isEdit) {
      updateEvent(event.id, fields)
      toast.success('Event saved')
    } else {
      createEvent(fields)
      toast.success('Event added')
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? 'Edit event' : 'New event'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. GMAT exam"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="ev-date">Date</Label>
              <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="ev-time">Time</Label>
              <Input id="ev-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    <span
                      className="mr-2 inline-block size-2 rounded-full align-middle"
                      style={{ backgroundColor: pillarColor(c) }}
                    />
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-notes">Notes</Label>
            <Textarea
              id="ev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional…"
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete event"
              onClick={() => {
                deleteEvent(event.id)
                toast('Event deleted')
                onOpenChange(false)
              }}
            >
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
