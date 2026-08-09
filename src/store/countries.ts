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

/**
 * Bulk-add countries from a pasted list (one per line, or comma/semicolon
 * separated). Case-insensitive dedupe against what's already logged.
 * Returns how many were actually added.
 */
export function addCountriesBulk(text: string, date = todayISO()): number {
  const existing = new Set(
    Object.values(store.getTable(T.countries)).map((r) => String(r.name ?? '').trim().toLowerCase()),
  )
  const names = text
    .split(/[\n,;]+/)
    .map((n) => n.replace(/^[\s\-*\d.)]+/, '').trim())
    .filter(Boolean)
  let added = 0
  store.transaction(() => {
    for (const name of names) {
      const key = name.toLowerCase()
      if (existing.has(key)) continue
      existing.add(key)
      store.setRow(T.countries, newId(), { name, date, ts: Date.now() + added })
      added++
    }
  })
  return added
}
