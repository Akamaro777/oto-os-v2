import { useMemo, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProgressRing } from '@/components/ProgressRing'
import { CountUp } from '@/components/CountUp'
import { LineTrend } from '@/components/charts'
import { pillarColor } from '@/lib/pillars'
import { shortDate, todayISO } from '@/lib/dates'
import { type NorthStar, type GoalStatus } from '@/store/northStars'
import { setProfileNumber } from '@/store/profile'
import { useMockExams } from '@/store/study'
import { useAllDeals } from '@/store/deals'
import { useCountries, addCountry, deleteCountry, addCountriesBulk } from '@/store/countries'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const STATUS_COLOR: Record<GoalStatus, string> = {
  complete: '#c9f158',
  ahead: '#c9f158',
  ontrack: '#8a8f98',
  behind: '#fbbf24',
  danger: '#f36a5a',
}

/** Which profile value a manually-counted goal edits. */
const COUNTER_KEY: Record<string, string> = {
  bodies: 'bodiesCount',
}

interface GoalDetailSheetProps {
  star: NorthStar | null
  onClose: () => void
}

/** Full "story" view for a North Star: big ring, the numbers, required rate, history chart. */
export function GoalDetailSheet({ star, onClose }: GoalDetailSheetProps) {
  const mocks = useMockExams()

  const series = useMemo(() => {
    if (!star) return []
    switch (star.id) {
      case 'gmat':
        return mocks.map((m) => ({ date: m.date, value: m.score }))
      default:
        return []
    }
  }, [star, mocks])

  const rate = useMemo(() => {
    if (!star || star.daysLeft <= 0) return null
    const gap = star.targetValue - star.currentValue
    if (gap <= 0) return 'target reached'
    switch (star.id) {
      case 'gmat':
        return `${Math.round(gap)} points to go`
      case 'mrr':
        return `+€${Math.ceil(gap).toLocaleString('en-US')}/mo to build`
      case 'countries':
        return `1 every ${Math.max(1, Math.floor(star.daysLeft / gap))}d`
      case 'bodies':
        return `1 every ${Math.max(1, Math.floor(star.daysLeft / gap))}d`
      default:
        return null
    }
  }, [star])

  if (!star) return null
  const color = pillarColor(star.pillar)
  const counterKey = COUNTER_KEY[star.id]

  return (
    <Sheet open={star != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="glass-heavy mx-auto flex max-h-[90dvh] max-w-md flex-col gap-4 rounded-t-3xl border-0 px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)]"
      >
        <SheetHeader className="shrink-0 px-0">
          <SheetTitle className="font-serif text-2xl">{star.label}</SheetTitle>
        </SheetHeader>

        <div className="-mx-1 flex-1 space-y-4 overflow-y-auto overscroll-contain px-1">
        <div className="flex items-center gap-5">
          <ProgressRing pct={star.pct} markerPct={star.expectedPct} color={color} size={110} stroke={8}>
            <span className="font-serif text-2xl">
              <CountUp value={star.pct} format={(v) => `${Math.round(v)}%`} />
            </span>
          </ProgressRing>
          <div className="flex-1 space-y-1.5">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ color: STATUS_COLOR[star.status] }}
            >
              {star.statusText}
            </p>
            <p className="font-serif text-3xl" style={{ color, textShadow: `0 0 24px ${color}44` }}>
              {star.current}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {star.pace} · {star.meta}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Target" value={fmtTarget(star)} />
          <Stat label="Days left" value={String(star.daysLeft)} />
          <Stat label="To stay on it" value={rate ?? '—'} highlight={color} />
        </div>

        {counterKey && (
          <CounterEditor
            label="Count"
            value={star.currentValue}
            color={color}
            onChange={(v) => setProfileNumber(counterKey, v)}
          />
        )}
        {star.id === 'mrr' && <PipelineSummary color={color} />}
        {star.id === 'countries' && <CountriesEditor color={color} />}

        {series.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <h3 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              History
            </h3>
            <LineTrend data={series} color={color} target={star.targetValue || undefined} height={170} />
          </div>
        )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** ± stepper for manually-counted goals (countries, bodies). */
function CounterEditor({
  label,
  value,
  color,
  onChange,
}: {
  label: string
  value: number
  color: string
  onChange: (v: number) => void
}) {
  return (
    <div className="glass flex items-center justify-between rounded-2xl p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          aria-label="Decrease"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus className="size-4" />
        </Button>
        <span className="min-w-8 text-center font-mono text-xl" style={{ color }}>
          {value}
        </span>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          aria-label="Increase"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/** Live pipeline breakdown — MRR is the sum of closed deals (edit in Track → Money). */
function PipelineSummary({ color }: { color: string }) {
  const deals = useAllDeals()
  const closed = deals.filter((d) => d.status === 'closed')
  const talking = deals.filter((d) => d.status === 'talking').length
  const leads = deals.filter((d) => d.status === 'lead').length
  return (
    <div className="glass space-y-2 rounded-2xl p-4">
      {closed.length > 0 ? (
        <ul className="space-y-1">
          {closed.map((d) => (
            <li key={d.id} className="flex items-center justify-between text-sm">
              <span className="min-w-0 truncate">{d.name}</span>
              <span className="shrink-0 font-mono text-[12px]" style={{ color }}>
                €{Math.round(d.mrr).toLocaleString('en-US')}/mo
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No paying clients yet.</p>
      )}
      <p className="font-mono text-[11px] text-muted-foreground">
        Pipeline: {talking} talking · {leads} leads — manage in Track → Money
      </p>
    </div>
  )
}

/** Named country log: each entry counts toward the travel goal. */
function CountriesEditor({ color }: { color: string }) {
  const countries = useCountries()
  const [draft, setDraft] = useState('')
  const [bulk, setBulk] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)

  function add() {
    const name = draft.trim()
    if (!name) return
    addCountry(name, todayISO())
    setDraft('')
    toast.success(`${name} added ✈️`)
  }

  function importBulk() {
    const added = addCountriesBulk(bulk)
    setBulk('')
    setBulkOpen(false)
    toast.success(added ? `${added} countries added ✈️` : 'Nothing new to add')
  }

  return (
    <div className="glass space-y-3 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a country…"
        />
        <Button variant="secondary" size="icon" onClick={add} aria-label="Add country">
          <Plus className="size-4" />
        </Button>
      </div>

      {bulkOpen ? (
        <div className="space-y-2">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={4}
            placeholder={'Paste your list from Bean — one country per line'}
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={importBulk}>
              Import list
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="w-full text-left font-mono text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Paste a list from Bean →
        </button>
      )}
      {countries.length > 0 && (
        <ul className="divide-y divide-border">
          {countries.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="shrink-0 font-mono text-[11px]" style={{ color }}>
                {c.date ? shortDate(c.date) : ''}
              </span>
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => deleteCountry(c.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function fmtTarget(star: NorthStar): string {
  switch (star.id) {
    case 'mrr':
      return `€${star.targetValue.toLocaleString('en-US')}/mo`
    default:
      return String(star.targetValue)
  }
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="glass rounded-xl px-2 py-3 text-center">
      <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-[13px] font-medium leading-tight"
        style={highlight ? { color: highlight } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
