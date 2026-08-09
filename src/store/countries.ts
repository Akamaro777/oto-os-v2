import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type CountryVisit } from './schema'
import { newId } from '@/lib/ids'
import { todayISO } from '@/lib/dates'

type Cells = Record<string, string | number | boolean | undefined>

/** Reactive list of visited countries, most recent first. */
export function useCountries(): CountryVisit[] {
  const table = useTable(T.countries, store) as Record<string, Cells>
  return useMemo(
    () =>
      Object.entries(table)
        .map(([id, row]) => ({
          id,
          name: String(row.name ?? ''),
          date: String(row.date ?? ''),
          ts: Number(row.ts ?? 0),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [table],
  )
}

export function addCountry(name: string, date = todayISO()): string {
  const id = newId()
  store.setRow(T.countries, id, { name: name.trim(), date, ts: Date.now() })
  return id
}

export function deleteCountry(id: string): void {
  store.delRow(T.countries, id)
}
