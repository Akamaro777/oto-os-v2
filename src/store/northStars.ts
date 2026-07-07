import { useMemo } from 'react'
import type { Pillar } from './schema'
import { todayISO, daysBetween } from '@/lib/dates'
import { getProfileNumber, getProfileString } from './profile'
import { useBodySeries } from './body'
import { useAllPortfolio } from './portfolio'
import { useBusinessCumulative } from './business'
import { useMockExams } from './study'

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

const BULK_BASELINE = 60 // Oto's historical starting weight

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

const kg = (v: number) => `${v.toFixed(1)}kg`
const eur = (v: number) => `€${Math.round(v).toLocaleString('en-US')}`
const hrs = (v: number) => `${v.toFixed(1)}h`
const pts = (v: number) => `${Math.round(v)} pts`

/** The North Star goal cards with pace maths, reacting to the store. */
export function useNorthStars(): NorthStar[] {
  const weightSeries = useBodySeries('weight')
  const portfolio = useAllPortfolio()
  const cumulative = useBusinessCumulative()
  const mocks = useMockExams()

  return useMemo(() => {
    const today = todayISO()
    const cards: NorthStar[] = []

    // ── Body: bulk before bulk date, else cut ──
    const latestWeight = weightSeries.length
      ? weightSeries[weightSeries.length - 1].value
      : getProfileNumber('weight')
    const bulkDate = getProfileString('bulkTargetDate')
    const bulkTgt = getProfileNumber('bulkTargetWeight')
    const cutDate = getProfileString('cutTargetDate')
    const cutTgt = getProfileNumber('cutTargetWeight')

    if (bulkDate && today < bulkDate) {
      const range = Math.max(0.1, bulkTgt - BULK_BASELINE)
      const pct = Math.min(100, (Math.max(0, latestWeight - BULK_BASELINE) / range) * 100)
      const total = Math.max(1, daysBetween('2025-11-07', bulkDate))
      const elapsed = Math.max(0, total - Math.max(0, daysBetween(today, bulkDate)))
      const expectedPct = Math.min(100, (elapsed / total) * 100)
      const expectedWeight = BULK_BASELINE + range * (expectedPct / 100)
      const status = statusOf(pct, expectedPct)
      cards.push({
        id: 'bulk',
        pillar: 'body',
        label: `Bulk → ${bulkTgt}kg`,
        pct,
        expectedPct,
        current: kg(latestWeight),
        meta: `${Math.max(0, daysBetween(today, bulkDate))}d left`,
        currentValue: latestWeight,
        targetValue: bulkTgt,
        daysLeft: Math.max(0, daysBetween(today, bulkDate)),
        status,
        statusText: statusText(status),
        pace: paceLine(latestWeight, expectedWeight, kg, false),
      })
    } else if (cutDate) {
      const start = bulkTgt
      const range = Math.max(0.1, start - cutTgt)
      const pct = Math.min(100, (Math.max(0, start - latestWeight) / range) * 100)
      const total = Math.max(1, daysBetween(bulkDate, cutDate))
      const elapsed = Math.max(0, total - Math.max(0, daysBetween(today, cutDate)))
      const expectedPct = Math.min(100, (elapsed / total) * 100)
      const expectedWeight = start - range * (expectedPct / 100)
      const status = statusOf(pct, expectedPct)
      cards.push({
        id: 'cut',
        pillar: 'body',
        label: `Cut → ${cutTgt}kg`,
        pct,
        expectedPct,
        current: kg(latestWeight),
        meta: `${Math.max(0, daysBetween(today, cutDate))}d left`,
        currentValue: latestWeight,
        targetValue: cutTgt,
        daysLeft: Math.max(0, daysBetween(today, cutDate)),
        status,
        statusText: statusText(status),
        pace: paceLine(latestWeight, expectedWeight, kg, true),
      })
    }

    // ── Money: portfolio → target ──
    const sortedP = [...portfolio].sort((a, b) => a.ts - b.ts)
    const current = sortedP.length ? sortedP[sortedP.length - 1].value : 0
    const moneyTgt = getProfileNumber('portfolioTarget')
    const moneyDate = getProfileString('portfolioTargetDate')
    const moneyPct = moneyTgt > 0 ? Math.min(100, (current / moneyTgt) * 100) : 0
    const moneyExpectedPct = (() => {
      if (!sortedP[0]) return 0
      const total = Math.max(1, daysBetween(sortedP[0].date, moneyDate))
      const elapsed = Math.max(0, total - Math.max(0, daysBetween(today, moneyDate)))
      const startPct = (sortedP[0].value / moneyTgt) * 100
      return Math.min(100, startPct + ((100 - startPct) * elapsed) / total)
    })()
    const moneyStatus = statusOf(moneyPct, moneyExpectedPct)
    cards.push({
      id: 'money',
      pillar: 'money',
      label: `${eur(moneyTgt)} portfolio`,
      pct: moneyPct,
      expectedPct: moneyExpectedPct,
      current: eur(current),
      meta: `${Math.max(0, daysBetween(today, moneyDate))}d left`,
      currentValue: current,
      targetValue: moneyTgt,
      daysLeft: Math.max(0, daysBetween(today, moneyDate)),
      status: moneyStatus,
      statusText: statusText(moneyStatus),
      pace: paceLine(current, moneyTgt * (moneyExpectedPct / 100), eur, false),
    })

    // ── Business: cumulative hours ──
    const bizPct = cumulative.target > 0 ? Math.min(100, (cumulative.logged / cumulative.target) * 100) : 0
    const bizTotal = Math.max(1, daysBetween(cumulative.start, cumulative.end))
    const bizElapsed = Math.max(0, Math.min(bizTotal, daysBetween(cumulative.start, today)))
    const bizExpectedPct = today < cumulative.start ? 0 : Math.min(100, (bizElapsed / bizTotal) * 100)
    const bizStatus = statusOf(bizPct, bizExpectedPct)
    cards.push({
      id: 'business',
      pillar: 'money',
      label: `${cumulative.target}h business`,
      pct: bizPct,
      expectedPct: bizExpectedPct,
      current: hrs(cumulative.logged),
      meta: `${Math.max(0, daysBetween(today, cumulative.end))}d left`,
      currentValue: cumulative.logged,
      targetValue: cumulative.target,
      daysLeft: Math.max(0, daysBetween(today, cumulative.end)),
      status: bizStatus,
      statusText: statusText(bizStatus),
      pace: paceLine(cumulative.logged, cumulative.target * (bizExpectedPct / 100), hrs, false),
    })

    // ── GMAT mock → target score ──
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

    return cards
  }, [weightSeries, portfolio, cumulative, mocks])
}
