import { useState } from 'react'
import { RefreshCw, Plus, Trash2, Loader2 } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { LineTrend } from '@/components/charts'
import { PILLAR_META } from '@/lib/pillars'
import { shortDate, todayISO } from '@/lib/dates'
import { getProfileNumber } from '@/store/profile'
import { getSetting } from '@/store/settings'
import { fetchT212Summary, T212Error } from '@/lib/t212'
import {
  useAllPortfolio,
  useLatestPortfolio,
  usePortfolioDailySeries,
  addPortfolioManual,
  addPortfolioFromT212,
  deletePortfolioEntry,
} from '@/store/portfolio'
import { toast } from 'sonner'

const MONEY = PILLAR_META.money.color

const eur = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export function MoneyTracker() {
  const entries = useAllPortfolio()
  const latest = useLatestPortfolio()
  const series = usePortfolioDailySeries()
  const [syncing, setSyncing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const target = getProfileNumber('portfolioTarget')
  const value = latest?.value ?? 0
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0

  async function handleSync() {
    setSyncing(true)
    try {
      const summary = await fetchT212Summary(getSetting('t212ProxyUrl'), getSetting('t212ProxySecret'))
      addPortfolioFromT212(summary)
      toast.success(`Synced: ${eur(summary.total)}`)
    } catch (err) {
      toast.error(err instanceof T212Error ? `Sync failed: ${err.message}` : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <TrackerCard title="Net worth">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-serif text-4xl" style={{ color: MONEY }}>
              {eur(value)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              target {eur(target)}
              {latest && ` · last ${shortDate(latest.date)}`}
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: MONEY }} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sync T212
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Manual
          </Button>
        </div>
      </TrackerCard>

      <TrackerCard title="Trend vs target">
        <LineTrend data={series} color={MONEY} unit="" target={target} height={170} />
      </TrackerCard>

      <TrackerCard title="History">
        {entries.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.slice(0, 20).map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums">{eur(e.value)}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {shortDate(e.date)} · {e.source ?? 'manual'}
                    {e.ppl != null && ` · P/L ${eur(e.ppl)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deletePortfolioEntry(e.id)}
                  aria-label="Delete entry"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </TrackerCard>

      <ManualEntryDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}

function ManualEntryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(todayISO())

  function handleAdd() {
    const v = Number(value)
    if (!v || v <= 0) {
      toast.error('Enter a value')
      return
    }
    addPortfolioManual(date || todayISO(), v)
    toast.success('Entry added')
    setValue('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add net worth</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-value">Value (€)</Label>
            <Input
              id="pf-value"
              type="number"
              inputMode="decimal"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 6268"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-date">Date</Label>
            <Input id="pf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={handleAdd}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
