import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type CalendarEvent } from './schema'
import { newId } from '@/lib/ids'

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

/* ── Mutations ── */

export interface EventInput {
  title: string
  date: string
  time?: string
  category?: string
  notes?: string
}

export function createEvent(input: EventInput): string {
  const id = newId()
  const row: Record<string, string | number> = {
    title: input.title.trim(),
    date: input.date,
    ts: Date.now(),
  }
  if (input.time) row.time = input.time
  if (input.category) row.category = input.category
  if (input.notes?.trim()) row.notes = input.notes.trim()
  store.setRow(T.events, id, row)
  return id
}

export function updateEvent(id: string, patch: EventInput): void {
  store.setCell(T.events, id, 'title', patch.title.trim())
  store.setCell(T.events, id, 'date', patch.date)
  for (const key of ['time', 'category', 'notes'] as const) {
    const v = patch[key]
    if (v && v.trim()) store.setCell(T.events, id, key, v.trim())
    else store.delCell(T.events, id, key)
  }
}

export function deleteEvent(id: string): void {
  store.delRow(T.events, id)
}
