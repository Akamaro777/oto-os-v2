import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type Idea } from './schema'
import { newId } from '@/lib/ids'
import { todayISO, addDaysISO } from '@/lib/dates'
import { getProfileNumber, getProfileString } from './profile'

type Cells = Record<string, string | number | boolean | undefined>

/* ── Daily business hours (money table) ── */

export function useBusinessHours(date: string): number {
  const table = useTable(T.money, store) as Record<string, Cells>
  return useMemo(() => Number(table[date]?.hours ?? 0), [table, date])
}

export function setBusinessHours(date: string, hours: number): void {
  const h = Math.max(0, hours)
  if (h === 0) store.delCell(T.money, date, 'hours')
  else store.setCell(T.money, date, 'hours', h)
}

export function useBusinessSeries(days = 7, anchor = todayISO()): { date: string; value: number }[] {
  const table = useTable(T.money, store) as Record<string, Cells>
  return useMemo(() => {
    const out: { date: string; value: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysISO(anchor, -i)
      out.push({ date, value: Number(table[date]?.hours ?? 0) })
    }
    return out
  }, [table, days, anchor])
}

export interface Cumulative {
  logged: number
  target: number
  start: string
  end: string
}

/** Hours logged since the cumulative start date vs the cumulative target. */
export function useBusinessCumulative(): Cumulative {
  const table = useTable(T.money, store) as Record<string, Cells>
  return useMemo(() => {
    const start = getProfileString('bizCumulativeStart')
    let logged = 0
    for (const [date, row] of Object.entries(table)) {
      if (!start || date >= start) logged += Number(row.hours ?? 0)
    }
    return {
      logged,
      target: getProfileNumber('bizCumulativeTarget'),
      start,
      end: getProfileString('bizCumulativeDate'),
    }
  }, [table])
}

/* ── Ideas bank ── */

function rowToIdea(id: string, row: Cells): Idea {
  return {
    id,
    title: String(row.title ?? ''),
    notes: row.notes ? String(row.notes) : undefined,
    ts: Number(row.ts ?? 0),
  }
}

export function useIdeas(): Idea[] {
  const table = useTable(T.ideas, store) as Record<string, Cells>
  return useMemo(
    () => Object.entries(table).map(([id, row]) => rowToIdea(id, row)).sort((a, b) => b.ts - a.ts),
    [table],
  )
}

export function addIdea(title: string, notes?: string): string {
  const id = newId()
  const row: Cells = { title: title.trim(), ts: Date.now() }
  if (notes?.trim()) row.notes = notes.trim()
  store.setRow(T.ideas, id, row as Record<string, string | number | boolean>)
  return id
}

export function deleteIdea(id: string): void {
  store.delRow(T.ideas, id)
}

/* ── Next-day plan (businessPlans, keyed by date) ── */

export function useBusinessPlan(date: string): string {
  const table = useTable(T.businessPlans, store) as Record<string, Cells>
  return useMemo(() => String(table[date]?.text ?? ''), [table, date])
}

export function setBusinessPlan(date: string, text: string): void {
  if (text.trim()) store.setRow(T.businessPlans, date, { text: text.trim(), ts: Date.now() })
  else store.delRow(T.businessPlans, date)
}
