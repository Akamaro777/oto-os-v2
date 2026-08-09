import { Cake, AtSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type Contact } from '@/store/schema'
import { logTouch } from '@/store/people'
import { reconnectDue, birthdaySoon, lastContactLabel } from '@/lib/people'
import { categoryMeta } from '@/lib/peopleCategories'
import { toast } from 'sonner'

interface ContactRowProps {
  contact: Contact
  onEdit: (contact: Contact) => void
}

export function ContactRow({ contact, onEdit }: ContactRowProps) {
  const due = reconnectDue(contact)
  const bday = birthdaySoon(contact)
  const sub = [contact.met, lastContactLabel(contact)].filter(Boolean).join(' · ')

  return (
    <div className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={() => onEdit(contact)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-xs text-muted-foreground"
          style={{ boxShadow: `0 0 0 1.5px ${categoryMeta(contact.category).color}66` }}
        >
          {contact.photo ? (
            <img src={contact.photo} alt="" className="size-full object-cover" />
          ) : (
            contact.name.slice(0, 2).toUpperCase()
          )}
        </span>
        <span className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{contact.name}</span>
          {bday && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pillar-social/15 px-1.5 py-0.5 font-mono text-[10px] text-pillar-social">
              <Cake className="size-2.5" /> soon
            </span>
          )}
          {due && (
            <span className="shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
              reconnect
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{sub}</p>
        </span>
      </button>
      {contact.instagram && (
        <a
          href={`https://instagram.com/${contact.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open @${contact.instagram} on Instagram`}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
        >
          <AtSign className="size-3.5" />
        </a>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={() => {
          logTouch(contact.id)
          toast.success(`Logged contact with ${contact.name}`)
        }}
      >
        Log
      </Button>
    </div>
  )
}
