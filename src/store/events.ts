import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type CalendarEvent } from './schema'

type Cells = Record<string, string | number | boolean | undefined>

function rowToEvent(id: string, row: Cells): CalendarEvent {
  return {
    id,
    title: String(row.title ?? ''),
    date: String(row.date ?? ''),
    time: row.time ? String(row.time) : undefined,
    category: row.category ? String(row.category) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    ts: Number(row.ts ?? 0),
  }
}

export function useAllEvents(): CalendarEvent[] {
  const table = useTable(T.events, store) as Record<string, Cells>
  return useMemo(() => Object.entries(table).map(([id, row]) => rowToEvent(id, row)), [table])
}

/** Events on a given date, sorted by time (all-day first). */
export function useEventsByDate(date: string): CalendarEvent[] {
  const all = useAllEvents()
  return useMemo(
    () =>
      all
        .filter((e) => e.date === date)
        .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [all, date],
  )
}
