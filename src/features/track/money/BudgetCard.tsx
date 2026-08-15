import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Loader2, Pencil } from 'lucide-react'
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
import { CountUp } from '@/components/CountUp'
import { PILLAR_META } from '@/lib/pillars'
import { parseDecimal } from '@/lib/numbers'
import { todayISO, shortDate } from '@/lib/dates'
import { syncWise, wiseConfigured, WiseError } from '@/lib/wise'
import { useWalletMonth, setWalletBalance, type BudgetPace } from '@/store/wallet'
import { toast } from 'sonner'

const MONEY = PILLAR_META.money.color

const eur = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const PACE_META: Record<BudgetPace, { label: string; color: string }> = {
  ahead: { label: 'ahead of budget', color: '#c9f158' },
  ontrack: { label: 'on track', color: '#8b8d95' },
  behind: { label: 'overspending', color: '#ef4444' },
}

/** Monthly spending money: what's left, today's burn, and the safe daily pace. */
export function BudgetCard() {
  const today = todayISO()
  const m = useWalletMonth(today)
  const [syncing, setSyncing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const autoSynced = useRef(false)

  async function handleSync(silent = false) {
    setSyncing(true)
    try {
      const r = await syncWise()
      if (!silent)
        toast.success(
          `Wise synced: ${eur(r.balance)} left${r.spentToday != null ? ` · ${eur(r.spentToday)} spent today` : ''}`,
        )
    } catch (err) {
      if (!silent) toast.error(err instanceof WiseError ? err.message : 'Wise sync failed')
    } finally {
      setSyncing(false)
    }
  }

  // One quiet refresh per visit when Wise is connected, so the numbers are
  // current without tapping anything.
  useEffect(() => {
    if (autoSynced.current || !wiseConfigured()) return
    autoSynced.current = true
    handleSync(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pace = m.pace ? PACE_META[m.pace] : null
  const leftPct = m.left != null ? Math.max(0, Math.min(100, (m.left / m.budget) * 100)) : 0
  const expectedPct = Math.max(0, Math.min(100, (m.expectedLeft / m.budget) * 100))

  return (
    <>
      <TrackerCard
        title="Spending money"
        action={
          pace && (
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
              style={{ backgroundColor: `${pace.color}22`, color: pace.color }}
            >
              {pace.label}
            </span>
          )
        }
      >
        {m.left == null ? (
          <p className="py-2 text-sm text-muted-foreground">
            No balance yet — sync Wise or set it by hand. The {eur(m.budget)} that lands on the 1st
            is tracked against the days left in the month.
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-serif text-4xl" style={{ color: MONEY, textShadow: `0 0 24px ${MONEY}44` }}>
                  <CountUp value={m.left} format={eur} />
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  left of {eur(m.budget)} · {m.daysRemaining} day{m.daysRemaining > 1 ? 's' : ''} to go
                  {m.lastDate && m.lastDate !== today && ` · as of ${shortDate(m.lastDate)}`}
                </p>
              </div>
              <div className="text-right">
                {m.dailyAllowance != null && (
                  <p className="font-mono text-sm tabular-nums" style={{ color: MONEY }}>
                    {eur(m.dailyAllowance)}/day
                  </p>
                )}
                {m.spentToday != null && (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {eur(m.spentToday)} spent today
                  </p>
                )}
              </div>
            </div>

            {/* Money left vs the linear burn-down marker */}
            <div className="relative mt-3 h-1.5 overflow-visible rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${leftPct}%`, backgroundColor: pace?.color ?? MONEY }}
              />
              <div
                className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/50"
                style={{ left: `${expectedPct}%` }}
                title="Where a steady month would be"
              />
            </div>
            {m.spentMonth != null && (
              <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                {eur(m.spentMonth)} spent this month
              </p>
            )}

            {m.series.length >= 2 && (
              <div className="mt-3">
                <LineTrend data={m.series} color={MONEY} height={120} />
              </div>
            )}
          </>
        )}

        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => handleSync()} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sync Wise
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Set balance
          </Button>
        </div>
      </TrackerCard>

      <SetBalanceDialog open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}

/** Manual fallback: type what's on the account right now. */
function SetBalanceDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) setValue('')
  }, [open])

  function handleSet() {
    const v = parseDecimal(value)
    if (Number.isNaN(v) || v < 0) {
      toast.error('Enter the current balance')
      return
    }
    setWalletBalance(todayISO(), v)
    toast.success(`Balance set: ${eur(v)}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Current balance</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="wb-value">What's on the account right now (€)</Label>
          <Input
            id="wb-value"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 1240"
          />
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={handleSet}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
