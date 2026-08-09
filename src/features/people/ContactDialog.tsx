import { useEffect, useRef, useState } from 'react'
import { Trash2, Camera, Plus } from 'lucide-react'
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
import {
  createContact,
  updateContact,
  deleteContact,
  useInteractions,
  addInteraction,
  deleteInteraction,
} from '@/store/people'
import { fileToJpegDataURL } from '@/lib/images'
import { todayISO, shortDate } from '@/lib/dates'
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
  const [tags, setTags] = useState('')
  const [photo, setPhoto] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(contact?.name ?? '')
    setMet(contact?.met ?? '')
    setLastContact(contact?.lastContact ?? (isEdit ? '' : todayISO()))
    setCadence(contact?.cadenceDays ? String(contact.cadenceDays) : '')
    setBirthday(contact?.birthday ?? '')
    setNotes(contact?.notes ?? '')
    setTags(contact?.tags ?? '')
    setPhoto(contact?.photo ?? '')
  }, [open, contact, isEdit])

  async function handlePhoto(file: File) {
    try {
      setPhoto(await fileToJpegDataURL(file, 192, 0.75))
    } catch {
      toast.error('Could not read that image')
    }
  }

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
      tags,
      photo,
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
      <DialogContent className="max-h-[85dvh] max-w-md gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? 'Edit person' : 'Add person'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo + name */}
          <div className="flex items-center gap-4">
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handlePhoto(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              aria-label="Set photo"
              className="relative size-16 shrink-0 overflow-hidden rounded-full bg-secondary"
            >
              {photo ? (
                <img src={photo} alt="" className="size-full object-cover" />
              ) : (
                <Camera className="absolute inset-0 m-auto size-5 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-met">How you met / context</Label>
            <Input
              id="c-met"
              value={met}
              onChange={(e) => setMet(e.target.value)}
              placeholder="e.g. NUS orientation, futsal"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-tags">Tags</Label>
            <Input
              id="c-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. nus, business (comma-separated)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="c-last">Last contact</Label>
              <Input
                id="c-last"
                type="date"
                value={lastContact}
                onChange={(e) => setLastContact(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
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
            <Label htmlFor="c-notes">Facts to remember</Label>
            <Textarea
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="From Milan, econ student, plays tennis…"
              rows={3}
            />
          </div>

          {isEdit && <InteractionTimeline contactId={contact.id} />}
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

/** Conversation log for a person: skim before you see them, add after you talk. */
function InteractionTimeline({ contactId }: { contactId: string }) {
  const interactions = useInteractions(contactId)
  const [draft, setDraft] = useState('')

  function add() {
    const note = draft.trim()
    if (!note) return
    addInteraction(contactId, note)
    setDraft('')
    toast.success('Logged')
  }

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <Label>Conversation log</Label>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="What did you talk about?"
        />
        <Button variant="secondary" size="icon" onClick={add} aria-label="Add note">
          <Plus className="size-4" />
        </Button>
      </div>
      {interactions.length > 0 && (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto">
          {interactions.map((i) => (
            <li key={i.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground">
                {shortDate(i.date)}
              </span>
              <span className="min-w-0 flex-1">{i.note}</span>
              <button
                type="button"
                aria-label="Delete note"
                onClick={() => deleteInteraction(i.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
