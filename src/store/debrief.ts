import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type Debrief } from './schema'

/** Save (or replace) the raw debrief transcript for a day. */
export function saveDebrief(date: string, text: string): void {
  store.setRow(T.debriefs, date, { text: text.trim(), summary: '', ts: Date.now() })
}

export function setDebriefSummary(date: string, summary: string): void {
  if (store.hasRow(T.debriefs, date)) store.setCell(T.debriefs, date, 'summary', summary.trim())
}

export function useDebrief(date: string): Debrief | undefined {
  const table = useTable(T.debriefs, store) as Record<string, Record<string, unknown>>
  return useMemo(() => {
    const row = table[date]
    if (!row?.text) return undefined
    return {
      date,
      text: String(row.text),
      summary: row.summary ? String(row.summary) : undefined,
      ts: Number(row.ts ?? 0),
    }
  }, [table, date])
}
