import { useMemo, useState } from 'react'
import { getDay, parseISO } from 'date-fns'
import { Sparkles, Loader2 } from 'lucide-react'
import { useTable } from 'tinybase/ui-react'
import { TrackerCard } from '@/components/TrackerCard'
import { Button } from '@/components/ui/button'
import { store } from '@/store/store'
import { T } from '@/store/schema'
import { getSetting } from '@/store/settings'
import { getProfileNumber } from '@/store/profile'
import { useGmatErrors, aggregateWeakSpots } from '@/store/study'
import { addDaysISO } from '@/lib/dates'
import { callMessages, MODELS, AnthropicError } from '@/lib/anthropic'
import { toast } from 'sonner'

type Row = Record<string, string | number | boolean | undefined>

interface WeekStats {
  rulesHit: number
  rulesPossible: number
  calls: number
  callsTarget: number
  studyHours: number
  latestMock: number | null
  weightDelta: number | null
  sleepAvg: number | null
}

function computeStats(days: string[], callsTarget: number): WeekStats {
  const rulesTable = store.getTable(T.rules) as Record<string, Row>
  const cvTable = store.getTable(T.cv) as Record<string, Row>
  const bodyTable = store.getTable(T.body) as Record<string, Row>
  const mocksTable = store.getTable(T.mockExams) as Record<string, Row>

  let rulesHit = 0
  let rulesPossible = 0
  let calls = 0
  let studyHours = 0
  const weights: number[] = []
  const sleeps: number[] = []

  for (const d of days) {
    const isSunday = getDay(parseISO(d)) === 0
    const keys = isSunday ? ['deepwork', 'noon', 'calls', 'run'] : ['deepwork', 'noon', 'calls']
    rulesPossible += keys.length
    const r = rulesTable[d] ?? {}
    const dayCalls = Number(cvTable[d]?.calls ?? 0)
    for (const k of keys) {
      // calls counts as hit when the target was actually reached, too
      if (r[k] || (k === 'calls' && dayCalls >= callsTarget)) rulesHit++
    }
    calls += dayCalls
    studyHours += Number(cvTable[d]?.studyHours ?? 0)
    const w = Number(bodyTable[d]?.weight ?? 0)
    if (w > 0) weights.push(w)
    const s = Number(bodyTable[d]?.sleep ?? 0)
    if (s > 0) sleeps.push(s)
  }

  const weekMocks = Object.values(mocksTable)
    .filter((m) => days.includes(String(m.date)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  return {
    rulesHit,
    rulesPossible,
    calls,
    callsTarget: callsTarget * 7,
    studyHours: Math.round(studyHours * 10) / 10,
    latestMock: weekMocks.length ? Number(weekMocks[weekMocks.length - 1].score) : null,
    weightDelta:
      weights.length >= 2 ? Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10 : null,
    sleepAvg: sleeps.length
      ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10
      : null,
  }
}

/** Sunday-only review of the week: the numbers plus an optional AI verdict. */
export function WeeklyReview({ date }: { date: string }) {
  const isSunday = getDay(parseISO(date)) === 0
  // Subscribe AND depend on the tables below, so the stats recompute as
  // today's data lands (a bare subscription re-renders but a memo without
  // these deps would keep returning the mount-time numbers).
  const rulesTable = useTable(T.rules, store)
  const cvTable = useTable(T.cv, store)
  const bodyTable = useTable(T.body, store)
  const mocksTable = useTable(T.mockExams, store)
  const errors = useGmatErrors()
  const [aiText, setAiText] = useState('')
  const [busy, setBusy] = useState(false)

  const callsTarget = getProfileNumber('callsDailyTarget') || 70
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(date, -(6 - i))),
    [date],
  )
  const stats = useMemo(
    () => computeStats(days, callsTarget),
    // The table deps are deliberate: computeStats reads them imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, callsTarget, rulesTable, cvTable, bodyTable, mocksTable],
  )

  if (!isSunday) return null

  async function generate() {
    const key = getSetting('apiKey')
    if (!key) {
      toast.error('Add your Anthropic API key in Settings first.')
      return
    }
    setBusy(true)
    try {
      const weak = aggregateWeakSpots(errors).slice(0, 3)
      const prompt = `Oto's week (${days[0]} → ${days[6]}):
- Non-negotiable rules hit: ${stats.rulesHit}/${stats.rulesPossible}
- Cold calls: ${stats.calls}/${stats.callsTarget}
- GMAT study: ${stats.studyHours}h${stats.latestMock ? ` · latest mock ${stats.latestMock} (target ${getProfileNumber('gmatTargetScore')})` : ' · no mock this week'}
- Weight change: ${stats.weightDelta != null ? `${stats.weightDelta > 0 ? '+' : ''}${stats.weightDelta}kg` : 'not logged'} · avg sleep ${stats.sleepAvg ?? '?'}h
- GMAT weak spots: ${weak.length ? weak.map((w) => `${w.topic} (${w.total})`).join(', ') : 'none logged'}
Write a direct 3-4 sentence weekly review: what went well, what slipped, and the single most important focus for next week. No fluff, no headers.`
      const text = await callMessages(key, {
        model: MODELS.sonnet,
        maxTokens: 400,
        system: 'You are a direct, no-bullshit accountability mentor. Use hyphens not em-dashes.',
        messages: [{ role: 'user', content: prompt }],
      })
      setAiText(text)
    } catch (err) {
      toast.error(err instanceof AnthropicError ? err.message : 'Review failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <TrackerCard title="Weekly review">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Rules" value={`${stats.rulesHit}/${stats.rulesPossible}`} />
        <Stat label="Calls" value={`${stats.calls}`} sub={`/${stats.callsTarget}`} />
        <Stat label="Study" value={`${stats.studyHours}h`} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Stat label="Mock" value={stats.latestMock != null ? String(stats.latestMock) : '—'} />
        <Stat
          label="Weight"
          value={stats.weightDelta != null ? `${stats.weightDelta > 0 ? '+' : ''}${stats.weightDelta}kg` : '—'}
        />
        <Stat label="Sleep" value={stats.sleepAvg != null ? `${stats.sleepAvg}h` : '—'} />
      </div>

      {aiText ? (
        <p className="mt-3 whitespace-pre-line rounded-xl bg-secondary/40 p-3 text-sm leading-relaxed">
          {aiText}
        </p>
      ) : (
        <Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={generate}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? 'Thinking…' : 'Get the verdict'}
        </Button>
      )}
    </TrackerCard>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 px-1 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">
        {value}
        {sub && <span className="text-muted-foreground">{sub}</span>}
      </p>
    </div>
  )
}
