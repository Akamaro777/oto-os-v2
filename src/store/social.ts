import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type SocialLog } from './schema'
import { todayISO, addDaysISO } from '@/lib/dates'

type Cells = Record<string, string | number | boolean | undefined>

function rowToSocialLog(date: string, row: Cells): SocialLog {
  return {
    date,
    rating: row.rating != null ? Number(row.rating) : undefined,
    approaches: row.approaches != null ? Number(row.approaches) : undefined,
    compliments: row.compliments != null ? Number(row.compliments) : undefined,
    connections: row.connections != null ? Number(row.connections) : undefined,
    note: row.note ? String(row.note) : undefined,
  }
}

export function useSocialLog(date: string): SocialLog | undefined {
  const table = useTable(T.social, store) as Record<string, Cells>
  return useMemo(() => {
    const row = table[date]
    return row ? rowToSocialLog(date, row) : undefined
  }, [table, date])
}

export type SocialCounter = 'approaches' | 'compliments' | 'connections'

export function setSocialRating(date: string, rating: number): void {
  store.setCell(T.social, date, 'rating', rating)
}

export function setSocialNote(date: string, note: string): void {
  if (note.trim()) store.setCell(T.social, date, 'note', note.trim())
  else store.delCell(T.social, date, 'note')
}

export function bumpSocialCounter(date: string, field: SocialCounter, delta: number): void {
  const current = Number(store.getCell(T.social, date, field) ?? 0)
  const next = Math.max(0, current + delta)
  if (next === 0) store.delCell(T.social, date, field)
  else store.setCell(T.social, date, field, next)
}

/** Rating series for the N days ending today (0 when unlogged). */
export function useSocialSeries(days = 7, anchor = todayISO()): { date: string; value: number }[] {
  const table = useTable(T.social, store) as Record<string, Cells>
  return useMemo(() => {
    const out: { date: string; value: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysISO(anchor, -i)
      out.push({ date, value: Number(table[date]?.rating ?? 0) })
    }
    return out
  }, [table, days, anchor])
}

/** Most recent days that have a note. */
export function useRecentSocialNotes(limit = 5): SocialLog[] {
  const table = useTable(T.social, store) as Record<string, Cells>
  return useMemo(
    () =>
      Object.entries(table)
        .map(([date, row]) => rowToSocialLog(date, row))
        .filter((d) => d.note)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit),
    [table, limit],
  )
}
