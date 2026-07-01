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
import { type Contact } from '@/store/schema'
import { createContact, updateContact, deleteContact } from '@/store/people'
import { todayISO } from '@/lib/dates'
import { toast } from 'sonner'

interface ContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
}

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const isEdit = contact != null
  const [name, setName] = useState('')
  const [met, setMet] = useState('')
  const [lastContact, setLastContact] = useState('')
  const [cadence, setCadence] = useState('')
  const [birthday, setBirthday] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setName(contact?.name ?? '')
    setMet(contact?.met ?? '')
    setLastContact(contact?.lastContact ?? (isEdit ? '' : todayISO()))
    setCadence(contact?.cadenceDays ? String(contact.cadenceDays) : '')
    setBirthday(contact?.birthday ?? '')
    setNotes(contact?.notes ?? '')
  }, [open, contact, isEdit])

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Enter a name')
      return
    }
    const fields = {
      name: trimmed,
      met,
      lastContact,
      cadenceDays: Number(cadence) || 0,
      birthday,
      notes,
    }
    if (isEdit) {
      updateContact(contact.id, fields)
      toast.success('Saved')
    } else {
      createContact(fields)
      toast.success('Person added')
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? 'Edit person' : 'Add person'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-met">How you met / context</Label>
            <Input
              id="c-met"
              value={met}
              onChange={(e) => setMet(e.target.value)}
              placeholder="e.g. PwC, Tilburg, futsal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-last">Last contact</Label>
              <Input
                id="c-last"
                type="date"
                value={lastContact}
                onChange={(e) => setLastContact(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-cadence">Reconnect (days)</Label>
              <Input
                id="c-cadence"
                type="number"
                min={0}
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
                placeholder="e.g. 21"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-bday">Birthday (MM-DD)</Label>
            <Input
              id="c-bday"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              placeholder="e.g. 03-17"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete person"
              onClick={() => {
                deleteContact(contact.id)
                toast('Deleted')
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
