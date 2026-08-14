import { useMemo, useRef, useState } from 'react'
import { Users, Plus, Mic, TriangleAlert, Brain, Search, ImageUp } from 'lucide-react'
import { toast } from 'sonner'
import { Screen, EmptyState } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VoiceDialog } from '@/components/VoiceDialog'
import { captureContact, extractInstagramProfile } from '@/lib/aiCapture'
import { AnthropicError } from '@/lib/anthropic'
import { fileToJpegDataURL, cropFileToJpegDataURL } from '@/lib/images'
import { todayISO } from '@/lib/dates'
import { type Contact } from '@/store/schema'
import {
  useAllContacts,
  sortByRecency,
  reconnectDueContacts,
  quizDueContacts,
} from '@/store/people'
import { PEOPLE_CATEGORIES, categoryMeta } from '@/lib/peopleCategories'
import { ContactRow } from './ContactRow'
import { ContactDialog } from './ContactDialog'
import { QuizSheet } from './QuizSheet'

/** Match against name, context, group, handle, tags and remembered facts. */
function matches(c: Contact, q: string): boolean {
  const group = categoryMeta(c.category).label
  const hay = `${c.name} ${c.met ?? ''} ${group} ${c.instagram ?? ''} ${c.tags ?? ''} ${c.notes ?? ''}`.toLowerCase()
  return q.split(/\s+/).every((word) => hay.includes(word))
}

export function PeopleScreen() {
  const contacts = useAllContacts()
  const [createOpen, setCreateOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | undefined>(undefined)
  const [igDraft, setIgDraft] = useState<Partial<Contact> | undefined>(undefined)
  const [igBusy, setIgBusy] = useState(false)
  const igInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('all')

  /** Instagram screenshot → extract handle/bio/avatar → prefilled contact card. */
  async function handleIgScreenshot(file: File) {
    setIgBusy(true)
    const tid = toast.loading('Reading screenshot…')
    try {
      const dataUrl = await fileToJpegDataURL(file, 1400, 0.85)
      const x = await extractInstagramProfile(dataUrl)
      let photo = ''
      if (x.avatar) {
        try {
          photo = await cropFileToJpegDataURL(file, x.avatar)
        } catch {
          // No avatar crop — the card still opens, photo can be set by hand.
        }
      }
      if (!x.username && !x.displayName && !x.facts) {
        throw new AnthropicError('Could not find profile info in that screenshot.')
      }
      const handle = x.username.toLowerCase()
      const existing =
        (handle && contacts.find((c) => (c.instagram ?? '').trim().toLowerCase() === handle)) ||
        (x.displayName &&
          contacts.find((c) => c.name.trim().toLowerCase() === x.displayName.trim().toLowerCase())) ||
        undefined
      if (existing) {
        // Merge: keep what's already there, fill the gaps, append new facts.
        const oldNotes = existing.notes ?? ''
        const newLines = x.facts
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !oldNotes.toLowerCase().includes(l.toLowerCase()))
        setEditing({
          ...existing,
          instagram: existing.instagram || x.username,
          photo: existing.photo || photo,
          notes: [oldNotes, ...newLines].filter(Boolean).join('\n'),
        })
        toast.success(`Matched ${existing.name} — review and save`)
      } else {
        setIgDraft({
          name: x.displayName || x.username || 'From Instagram',
          instagram: x.username,
          photo,
          notes: x.facts,
        })
      }
    } catch (err) {
      toast.error(err instanceof AnthropicError ? err.message : 'Could not read that screenshot')
    } finally {
      toast.dismiss(tid)
      setIgBusy(false)
    }
  }

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    let list = q ? contacts.filter((c) => matches(c, q)) : contacts
    if (group !== 'all') list = list.filter((c) => (c.category ?? 'other') === group)
    return list
  }, [contacts, q, group])
  const sorted = useMemo(() => sortByRecency(filtered), [filtered])
  const due = useMemo(() => (q || group !== 'all' ? [] : reconnectDueContacts(contacts)), [contacts, q, group])

  // Only show group chips that actually have people in them.
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of contacts) {
      const id = c.category ?? 'other'
      counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  }, [contacts])
  const quizDue = useMemo(() => quizDueContacts(contacts, todayISO()).length, [contacts])

  return (
    <Screen
      title="People"
      subtitle={`${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`}
      action={
        <div className="flex gap-2">
          <input
            ref={igInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleIgScreenshot(f)
              e.target.value = ''
            }}
          />
          <Button
            size="icon"
            variant="secondary"
            className="rounded-full"
            onClick={() => igInputRef.current?.click()}
            disabled={igBusy}
            aria-label="Add person from an Instagram screenshot"
          >
            <ImageUp className="size-5" />
          </Button>
          <Button
            size="icon"
            className="glow-primary rounded-full"
            onClick={() => setVoiceOpen(true)}
            aria-label="Add person by voice"
          >
            <Mic className="size-5" />
          </Button>
          <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="size-5" />
          </Button>
        </div>
      }
    >
      {contacts.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} message="No contacts yet — tap + to add one." />
      ) : (
        <div className="space-y-4">
          {/* Search + recall quiz */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people, facts, tags…"
                className="pl-8"
              />
            </div>
            <Button variant="secondary" onClick={() => setQuizOpen(true)} aria-label="Recall quiz">
              <Brain className="size-4 text-pillar-social" />
              {quizDue > 0 && <span className="font-mono text-xs">{quizDue}</span>}
            </Button>
          </div>

          {/* Group filter */}
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            <GroupChip label="All" count={contacts.length} active={group === 'all'} onClick={() => setGroup('all')} />
            {PEOPLE_CATEGORIES.filter((c) => groupCounts[c.id]).map((c) => (
              <GroupChip
                key={c.id}
                label={c.label}
                count={groupCounts[c.id]}
                color={c.color}
                active={group === c.id}
                onClick={() => setGroup(c.id)}
              />
            ))}
          </div>

          {due.length > 0 && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
              <div className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-amber-400">
                <TriangleAlert className="size-3.5" />
                Reconnect due · {due.length}
              </div>
              <div className="divide-y divide-border">
                {due.map((c) => (
                  <ContactRow key={c.id} contact={c} onEdit={setEditing} />
                ))}
              </div>
            </div>
          )}

          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {query.trim() ? `No one matches “${query}”.` : 'No one in this group yet.'}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {sorted.map((c) => (
                <ContactRow key={c.id} contact={c} onEdit={setEditing} />
              ))}
            </div>
          )}
        </div>
      )}

      <ContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ContactDialog
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(undefined)}
        contact={editing}
      />
      <ContactDialog
        open={igDraft != null}
        onOpenChange={(open) => !open && setIgDraft(undefined)}
        draft={igDraft}
      />
      <QuizSheet open={quizOpen} onOpenChange={setQuizOpen} contacts={contacts} />
      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        title="Add person"
        hint="Who did you meet? Name, where, every fact you remember"
        placeholder="e.g. Met Laura at NUS orientation, from Milan, econ student, plays tennis, going to Bali next week…"
        process={captureContact}
      />
    </Screen>
  )
}

function GroupChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string
  count: number
  color?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
      }`}
    >
      {color && !active && (
        <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
      <span className="font-mono text-[10px] opacity-70">{count}</span>
    </button>
  )
}
