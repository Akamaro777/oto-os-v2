import { useMemo } from 'react'
import { useValue, useValues } from 'tinybase/ui-react'
import type { Pillar } from './schema'
import { store } from './store'
import { daysBetween } from '@/lib/dates'
import { useToday } from '@/lib/useToday'
import { getProfileNumber, getProfileString } from './profile'
import { useMockExams } from './study'
import { useLiveMrr } from './deals'
import { useLatestRevenue } from './revenue'
import { useCountries } from './countries'

export type GoalStatus = 'complete' | 'ahead' | 'ontrack' | 'behind' | 'danger'

export interface NorthStar {
  id: string
  pillar: Pillar
  label: string
  /** 0–100 actual progress. */
  pct: number
  /** 0–100 where you'd be exactly on pace today. */
  expectedPct: number
  current: string
  meta: string
  status: GoalStatus
  statusText: string
  /** e.g. '1.2kg ahead' / '€400 behind'. */
  pace: string
  /** Raw numbers for the detail view. */
  currentValue: number
  targetValue: number
  daysLeft: number
}

function statusOf(pct: number, expected: number): GoalStatus {
  if (pct >= 100) return 'complete'
  if (pct >= expected + 5) return 'ahead'
  if (pct >= expected - 10) return 'ontrack'
  if (pct >= expected - 25) return 'behind'
  return 'danger'
}

function statusText(s: GoalStatus): string {
  return s === 'complete'
    ? '✓ HIT'
    : s === 'ahead'
      ? 'AHEAD'
      : s === 'ontrack'
        ? 'ON TRACK'
        : s === 'behind'
          ? 'BEHIND'
          : 'OFF PACE'
}

function paceLine(
  actual: number,
  expected: number,
  fmt: (v: number) => string,
  lowerIsBetter: boolean,
): string {
  const diff = lowerIsBetter ? expected - actual : actual - expected
  if (Math.abs(diff) < 0.05) return 'on pace'
  return `${fmt(Math.abs(diff))} ${diff >= 0 ? 'ahead' : 'behind'}`
}

const eur = (v: number) => `€${Math.round(v).toLocaleString('en-US')}`
const pts = (v: number) => `${Math.round(v)} pts`
const count = (v: number) => `${Math.round(v * 10) / 10}`

/** A goal whose "current" is a manually-updated profile number, paced linearly start→deadline. */
function manualCard(opts: {
  id: string
  pillar: Pillar
  label: string
  current: number
  target: number
  start: string
  end: string
  today: string
  fmtCurrent: string
  fmt: (v: number) => string
}): NorthStar {
  const { id, pillar, label, current, target, start, end, today, fmtCurrent, fmt } = opts
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const total = Math.max(1, daysBetween(start, end))
  const elapsed = Math.max(0, Math.min(total, daysBetween(start, today)))
  const expectedPct = Math.min(100, (elapsed / total) * 100)
  const status = statusOf(pct, expectedPct)
  const daysLeft = Math.max(0, daysBetween(today, end))
  return {
    id,
    pillar,
    label,
    pct,
    expectedPct,
    current: fmtCurrent,
    meta: `${daysLeft}d left`,
    currentValue: current,
    targetValue: target,
    daysLeft,
    status,
    statusText: statusText(status),
    pace: paceLine(current, target * (expectedPct / 100), fmt, false),
  }
}

/** The North Star goal cards with pace maths, reacting to the store. */
export function useNorthStars(): NorthStar[] {
  const mocks = useMockExams()
  // Live milestone sources: logged monthly revenue (fallback: closed deals),
  // countries counts the visit log.
  const logged = useLatestRevenue()
  const fromDeals = useLiveMrr()
  const mrr = logged > 0 ? logged : fromDeals
  const countries = useCountries().length
  const bodies = Number(useValue('profile.bodiesCount', store) ?? 0)
  // The maths reads many profile.* values imperatively; depending on the whole
  // values object (cheap — it's one flat record) keeps target edits live, and
  // useToday keeps "Xd left" honest after midnight without a remount.
  const today = useToday()
  const values = useValues(store)

  return useMemo(() => {
    const cards: NorthStar[] = []

    // ── GMAT mock → 705 ──
    const sortedM = [...mocks].sort((a, b) => a.date.localeCompare(b.date))
    const scoreTgt = getProfileNumber('gmatTargetScore')
    const gmatDate = getProfileString('gmatTargetDate')
    if (sortedM.length > 0) {
      const start = sortedM[0].score
      const latest = sortedM[sortedM.length - 1].score
      const range = Math.max(1, scoreTgt - start)
      const pct = Math.min(100, (Math.max(0, latest - start) / range) * 100)
      const total = Math.max(1, daysBetween(sortedM[0].date, gmatDate))
      const elapsed = Math.max(0, total - Math.max(0, daysBetween(today, gmatDate)))
      const expectedPct = Math.min(100, (elapsed / total) * 100)
      const status = statusOf(pct, expectedPct)
      cards.push({
        id: 'gmat',
        pillar: 'cv',
        label: `GMAT → ${scoreTgt}`,
        pct,
        expectedPct,
        current: `${latest}`,
        meta: `${Math.max(0, daysBetween(today, gmatDate))}d left`,
        currentValue: latest,
        targetValue: scoreTgt,
        daysLeft: Math.max(0, daysBetween(today, gmatDate)),
        status,
        statusText: statusText(status),
        pace: paceLine(latest, start + range * (expectedPct / 100), pts, false),
      })
    } else {
      cards.push({
        id: 'gmat',
        pillar: 'cv',
        label: `GMAT → ${scoreTgt}`,
        pct: 0,
        expectedPct: 0,
        current: '—',
        meta: `${Math.max(0, daysBetween(today, gmatDate))}d left`,
        currentValue: 0,
        targetValue: scoreTgt,
        daysLeft: Math.max(0, daysBetween(today, gmatDate)),
        status: 'ontrack',
        statusText: 'NO MOCKS',
        pace: 'log a mock',
      })
    }

    // ── Money: €5k/month by December ──
    cards.push(
      manualCard({
        id: 'mrr',
        pillar: 'money',
        label: `${eur(getProfileNumber('mrrTarget'))}/mo by Dec`,
        current: mrr,
        target: getProfileNumber('mrrTarget'),
        start: getProfileString('mrrStartDate') || '2026-08-06',
        end: getProfileString('mrrTargetDate') || '2026-12-31',
        today,
        fmtCurrent: `${eur(mrr)}/mo`,
        fmt: eur,
      }),
    )

    // ── Personal: visit 12 countries ──
    cards.push(
      manualCard({
        id: 'countries',
        pillar: 'personal',
        label: `Visit ${getProfileNumber('countriesTarget')} countries`,
        current: countries,
        target: getProfileNumber('countriesTarget'),
        start: getProfileString('countriesStartDate') || '2026-08-06',
        end: getProfileString('countriesTargetDate') || '2026-12-31',
        today,
        fmtCurrent: `${countries}/${getProfileNumber('countriesTarget')}`,
        fmt: count,
      }),
    )

    // ── Social: "30" (label is just the number, per Oto) ──
    cards.push(
      manualCard({
        id: 'bodies',
        pillar: 'social',
        label: `${getProfileNumber('bodiesTarget')}`,
        current: bodies,
        target: getProfileNumber('bodiesTarget'),
        start: getProfileString('bodiesStartDate') || '2026-08-06',
        end: getProfileString('bodiesTargetDate') || '2026-12-31',
        today,
        fmtCurrent: `${bodies}/${getProfileNumber('bodiesTarget')}`,
        fmt: count,
      }),
    )

    return cards
    // `values` is deliberate: the body reads profile.* imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mocks, mrr, countries, bodies, today, values])
}
