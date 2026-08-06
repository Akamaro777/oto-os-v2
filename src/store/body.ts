import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type BodyLog, type GymWeek } from './schema'
import { isoWeekKey } from '@/lib/dates'
import { parseDecimal } from '@/lib/numbers'

type Cells = Record<string, string | number | boolean | undefined>

/* ── Daily body log (rowId = date) ── */

function rowToBodyLog(date: string, row: Cells): BodyLog {
  return {
    date,
    weight: row.weight != null ? Number(row.weight) : undefined,
    sleep: row.sleep != null ? Number(row.sleep) : undefined,
    water: row.water != null ? Number(row.water) : undefined,
    gym: Boolean(row.gym),
    gymNotes: row.gymNotes ? String(row.gymNotes) : undefined,
    cardio: Boolean(row.cardio),
    cardioKm: row.cardioKm != null ? Number(row.cardioKm) : undefined,
    cardioMin: row.cardioMin != null ? Number(row.cardioMin) : undefined,
  }
}

export function useBodyLog(date: string): BodyLog | undefined {
  const table = useTable(T.body, store) as Record<string, Cells>
  return useMemo(() => {
    const row = table[date]
    return row ? rowToBodyLog(date, row) : undefined
  }, [table, date])
}

/** All body logs with a numeric field set, sorted by date ascending (for trends). */
export function useBodySeries(field: 'weight' | 'sleep'): { date: string; value: number }[] {
  const table = useTable(T.body, store) as Record<string, Cells>
  return useMemo(
    () =>
      Object.entries(table)
        .filter(([, row]) => row[field] != null)
        .map(([date, row]) => ({ date, value: Number(row[field]) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [table, field],
  )
}

/** Days with any body log — for the consistency heatmap (1 per logged day). */
export function useBodyActivityMap(): Record<string, number> {
  const table = useTable(T.body, store) as Record<string, Cells>
  return useMemo(() => {
    const out: Record<string, number> = {}
    for (const [date, row] of Object.entries(table)) {
      if (Object.keys(row).length > 0) out[date] = 1
    }
    return out
  }, [table])
}

/** Set (or clear when '') a numeric body field for a date. Accepts ',' or '.' decimals. */
export function setBodyNumber(date: string, field: 'weight' | 'sleep' | 'water', value: string): void {
  const num = parseDecimal(value)
  if (value === '' || Number.isNaN(num)) store.delCell(T.body, date, field)
  else store.setCell(T.body, date, field, num)
}

/* ── Weekly training grid (rowId = 'YYYY-Www') ── */

/** The 5 weekly training slots (the last merges stretch/abs, per SPEC). */
export const GYM_SLOTS = [
  { key: 'push', label: 'Push' },
  { key: 'pull', label: 'Pull' },
  { key: 'legs', label: 'Legs' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'abs', label: 'Stretch/Abs' },
  { key: 'run', label: 'Run' },
] as const

export type GymSlot = (typeof GYM_SLOTS)[number]['key']

function rowToGymWeek(week: string, row: Cells): GymWeek {
  return {
    week,
    push: row.push ? String(row.push) : undefined,
    pull: row.pull ? String(row.pull) : undefined,
    legs: row.legs ? String(row.legs) : undefined,
    shoulders: row.shoulders ? String(row.shoulders) : undefined,
    abs: row.abs ? String(row.abs) : undefined,
    stretch: row.stretch ? String(row.stretch) : undefined,
    run: row.run ? String(row.run) : undefined,
  }
}

export function useGymWeek(week: string): GymWeek {
  const table = useTable(T.gymSessions, store) as Record<string, Cells>
  return useMemo(() => rowToGymWeek(week, table[week] ?? {}), [table, week])
}

/** Toggle a session for a week: set to `date` when empty, clear when already done. */
export function toggleGymSession(week: string, slot: GymSlot, date: string): void {
  const current = store.getCell(T.gymSessions, week, slot)
  if (current) store.delCell(T.gymSessions, week, slot)
  else store.setCell(T.gymSessions, week, slot, date)
}

/** All-time counts per session type across every week (for the totals chart). */
export function useGymTotals(): { label: string; count: number }[] {
  const table = useTable(T.gymSessions, store) as Record<string, Cells>
  return useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of Object.values(table)) {
      for (const { key } of GYM_SLOTS) {
        if (row[key]) counts[key] = (counts[key] ?? 0) + 1
      }
      // legacy 'stretch' folds into the Stretch/Abs tile
      if (row.stretch) counts.abs = (counts.abs ?? 0) + 1
    }
    return GYM_SLOTS.map((s) => ({ label: s.label, count: counts[s.key] ?? 0 }))
  }, [table])
}

export { isoWeekKey }
