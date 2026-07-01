import { useMemo, useState } from 'react'
import { Users, Plus, TriangleAlert } from 'lucide-react'
import { Screen, EmptyState } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { type Contact } from '@/store/schema'
import { useAllContacts, sortByRecency, reconnectDueContacts } from '@/store/people'
import { ContactRow } from './ContactRow'
import { ContactDialog } from './ContactDialog'

export function PeopleScreen() {
  const contacts = useAllContacts()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | undefined>(undefined)

  const sorted = useMemo(() => sortByRecency(contacts), [contacts])
  const due = useMemo(() => reconnectDueContacts(contacts), [contacts])

  return (
    <Screen
      title="People"
      subtitle={`${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`}
      action={
        <Button size="icon" className="rounded-full" onClick={() => setCreateOpen(true)}>
          <Plus className="size-5" />
        </Button>
      }
    >
      {contacts.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} message="No contacts yet — tap + to add one." />
      ) : (
        <div className="space-y-6">
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

          <div className="divide-y divide-border">
            {sorted.map((c) => (
              <ContactRow key={c.id} contact={c} onEdit={setEditing} />
            ))}
          </div>
        </div>
      )}

      <ContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ContactDialog
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(undefined)}
        contact={editing}
      />
    </Screen>
  )
}
