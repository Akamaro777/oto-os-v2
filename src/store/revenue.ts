import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type RevenueMonth } from './schema'
import { todayISO } from '@/lib/dates'

type Cells = Record<string, string | number | boolean | undefined>

/** 'YYYY-MM' for a date (defaults to today). */
export function monthKey(date = todayISO()): string {
  return date.slice(0, 7)
}

/** Reactive revenue history, oldest first. */
export function useRevenue(): RevenueMonth[] {
  const table = useTable(T.revenue, store) as Record<string, Cells>
  return useMemo(
    () =>
      Object.entries(table)
        .map(([month, row]) => ({
          month,
          amount: Number(row.amount ?? 0),
          note: row.note ? String(row.note) : undefined,
          ts: Number(row.ts ?? 0),
        }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    [table],
  )
}

/** Latest logged month's revenue — the live number for the €5k/mo goal. */
export function useLatestRevenue(): number {
  const rows = useRevenue()
  return rows.length ? rows[rows.length - 1].amount : 0
}

export function setRevenue(month: string, amount: number, note?: string): void {
  const row: Cells = { month, amount: Math.max(0, amount), ts: Date.now() }
  if (note?.trim()) row.note = note.trim()
  store.setRow(T.revenue, month, row as Record<string, string | number | boolean>)
}

export function deleteRevenue(month: string): void {
  store.delRow(T.revenue, month)
}
