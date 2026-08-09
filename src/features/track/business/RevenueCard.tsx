import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { TrackerCard } from '@/components/TrackerCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LineTrend } from '@/components/charts'
import { CountUp } from '@/components/CountUp'
import { PILLAR_META } from '@/lib/pillars'
import { parseDecimal } from '@/lib/numbers'
import { getProfileNumber } from '@/store/profile'
import { useRevenue, useLatestRevenue, setRevenue, deleteRevenue, monthKey } from '@/store/revenue'
import { toast } from 'sonner'

const MONEY = PILLAR_META.money.color
const eur = (n: number) => `€${Math.round(n).toLocaleString('en-US')}`
const monthLabel = (m: string) => format(parseISO(`${m}-01`), 'MMM yyyy')

/** Monthly business revenue — the real number behind the €5k/mo objective. */
export function RevenueCard() {
  const rows = useRevenue()
  const latest = useLatestRevenue()
  const target = getProfileNumber('mrrTarget') || 5000
  const [month, setMonth] = useState(monthKey())
  const [amount, setAmount] = useState('')

  function save() {
    const v = parseDecimal(amount)
    if (v == null || Number.isNaN(v) || v < 0) {
      toast.error('Enter an amount')
      return
    }
    setRevenue(month, v)
    setAmount('')
    toast.success(`${monthLabel(month)}: ${eur(v)}`)
  }

  const series = rows.map((r) => ({ date: `${r.month}-01`, value: r.amount }))

  return (
    <TrackerCard title="Monthly revenue">
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-4xl" style={{ color: MONEY, textShadow: `0 0 24px ${MONEY}44` }}>
          <CountUp value={latest} format={eur} />
        </span>
        <span className="font-mono text-sm text-muted-foreground">/mo · target {eur(target)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.min(100, (latest / target) * 100)}%`, backgroundColor: MONEY }}
        />
      </div>

      {/* Entry — two equal columns, then a full-width save (native month inputs
          have a fixed intrinsic width, so the columns need min-w-0). */}
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="rev-month">Month</Label>
            <Input id="rev-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="rev-amount">Revenue (€)</Label>
            <Input
              id="rev-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="e.g. 1200"
            />
          </div>
        </div>
        <Button variant="secondary" className="w-full" onClick={save}>
          Save
        </Button>
      </div>

      {rows.length > 1 && (
        <div className="mt-4">
          <LineTrend data={series} color={MONEY} unit="" target={target} height={150} />
        </div>
      )}

      {rows.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {[...rows].reverse().map((r) => (
            <li key={r.month} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{monthLabel(r.month)}</span>
              <span className="shrink-0 font-mono text-[13px]" style={{ color: MONEY }}>
                {eur(r.amount)}
              </span>
              <button
                type="button"
                aria-label={`Delete ${r.month}`}
                onClick={() => deleteRevenue(r.month)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </TrackerCard>
  )
}
