import { useEffect, useState } from 'react'
import { Plus, Mic, Trash2 } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VoiceDialog } from '@/components/VoiceDialog'
import { PILLAR_META } from '@/lib/pillars'
import { parseDecimal } from '@/lib/numbers'
import { captureDeal } from '@/lib/aiCapture'
import { getProfileNumber } from '@/store/profile'
import {
  useAllDeals,
  useLiveMrr,
  createDeal,
  updateDeal,
  deleteDeal,
  DEAL_STATUSES,
} from '@/store/deals'
import { type Deal } from '@/store/schema'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const MONEY = PILLAR_META.money.color

const STATUS_LABEL: Record<string, string> = {
  lead: 'Lead',
  talking: 'Talking',
  closed: 'Closed',
  lost: 'Lost',
}

const eur = (n: number) => `€${Math.round(n).toLocaleString('en-US')}`

/** The client pipeline: closed deals sum into live MRR toward the €5k/mo goal. */
export function DealsCard() {
  const deals = useAllDeals()
  const mrr = useLiveMrr()
  const target = getProfileNumber('mrrTarget') || 5000
  const [dialogOpen, setDialogOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [editing, setEditing] = useState<Deal | undefined>(undefined)

  const byStatus = (s: string) => deals.filter((d) => d.status === s)

  return (
    <TrackerCard
      title="Clients & pipeline"
      action={
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setVoiceOpen(true)} aria-label="Add deal by voice">
            <Mic className="size-3.5" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setEditing(undefined); setDialogOpen(true) }}>
            <Plus className="size-3.5" /> Deal
          </Button>
        </div>
      }
    >
      <div className="mb-3">
        <span className="font-serif text-4xl" style={{ color: MONEY, textShadow: `0 0 24px ${MONEY}44` }}>
          {eur(mrr)}
        </span>
        <span className="font-mono text-sm text-muted-foreground">/mo · target {eur(target)}</span>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${Math.min(100, (mrr / target) * 100)}%`, backgroundColor: MONEY }}
          />
        </div>
      </div>

      {deals.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          No deals yet — add your first lead.
        </p>
      ) : (
        <div className="space-y-3">
          {/* 'lost' stays listed (muted, last) — otherwise a deal fat-fingered
              to lost becomes permanently unreachable, with no way to reopen. */}
          {(['closed', 'talking', 'lead', 'lost'] as const).map((status) => {
            const group = byStatus(status)
            if (!group.length) return null
            return (
              <div key={status}>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {STATUS_LABEL[status]} · {group.length}
                </p>
                <ul className="divide-y divide-border">
                  {group.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => { setEditing(d); setDialogOpen(true) }}
                        className="flex w-full items-center gap-2 py-2 text-left"
                      >
                        <span
                          className={cn('size-2 shrink-0 rounded-full')}
                          style={{ backgroundColor: status === 'closed' ? MONEY : status === 'talking' ? '#fbbf24' : '#8b8d95' }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{d.name}</span>
                        {d.mrr > 0 && (
                          <span className="shrink-0 font-mono text-[11px]" style={status === 'closed' ? { color: MONEY } : undefined}>
                            {eur(d.mrr)}/mo
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      <DealDialog open={dialogOpen} onOpenChange={setDialogOpen} deal={editing} />
      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        title="Add deal"
        hint="Who, how much per month, what stage"
        placeholder="e.g. New lead — Marco from the gym, maybe 500 a month for social media…"
        process={captureDeal}
      />
    </TrackerCard>
  )
}

function DealDialog({
  open,
  onOpenChange,
  deal,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  deal?: Deal
}) {
  const isEdit = deal != null
  const [name, setName] = useState('')
  const [mrr, setMrr] = useState('')
  const [status, setStatus] = useState('lead')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setName(deal?.name ?? '')
    setMrr(deal?.mrr ? String(deal.mrr) : '')
    setStatus(deal?.status ?? 'lead')
    setNotes(deal?.notes ?? '')
  }, [open, deal])

  function handleSave() {
    if (!name.trim()) {
      toast.error('Enter a client name')
      return
    }
    const fields = { name, mrr: parseDecimal(mrr) || 0, status, notes }
    if (isEdit) {
      updateDeal(deal.id, fields)
      toast.success('Deal saved')
    } else {
      createDeal(fields)
      toast.success('Deal added')
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{isEdit ? 'Edit deal' : 'New deal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal-name">Client</Label>
            <Input id="deal-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Client or company" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="deal-mrr">€ / month</Label>
              <Input
                id="deal-mrr"
                type="text"
                inputMode="decimal"
                value={mrr}
                onChange={(e) => setMrr(e.target.value)}
                placeholder="e.g. 800"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea id="deal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Context, next step…" />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete deal"
              onClick={() => {
                deleteDeal(deal.id)
                toast('Deal deleted')
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
