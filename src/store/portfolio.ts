import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type PortfolioEntry } from './schema'
import { newId } from '@/lib/ids'
import { todayISO } from '@/lib/dates'
import type { T212Summary } from '@/lib/t212'

type Cells = Record<string, string | number | boolean | undefined>

function rowToEntry(id: string, row: Cells): PortfolioEntry {
  return {
    id,
    date: String(row.date ?? ''),
    value: Number(row.value ?? 0),
    ts: Number(row.ts ?? 0),
    source: row.source ? String(row.source) : undefined,
    free: row.free != null ? Number(row.free) : undefined,
    invested: row.invested != null ? Number(row.invested) : undefined,
    ppl: row.ppl != null ? Number(row.ppl) : undefined,
  }
}

/** All entries, newest by DATE first (entry time breaks ties) — backfilling an
 * old date must not make it the "current" net worth. */
export function useAllPortfolio(): PortfolioEntry[] {
  const table = useTable(T.portfolio, store) as Record<string, Cells>
  return useMemo(
    () =>
      Object.entries(table)
        .map(([id, row]) => rowToEntry(id, row))
        .sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts),
    [table],
  )
}

export function useLatestPortfolio(): PortfolioEntry | undefined {
  const all = useAllPortfolio()
  return all[0]
}

/** One point per day (the day's last recorded value), oldest first — for the trend. */
export function usePortfolioDailySeries(): { date: string; value: number }[] {
  const table = useTable(T.portfolio, store) as Record<string, Cells>
  return useMemo(() => {
    const byDay = new Map<string, { ts: number; value: number }>()
    for (const row of Object.values(table)) {
      const date = String(row.date ?? '')
      const ts = Number(row.ts ?? 0)
      const value = Number(row.value ?? 0)
      const existing = byDay.get(date)
      if (!existing || ts >= existing.ts) byDay.set(date, { ts, value })
    }
    return [...byDay.entries()]
      .map(([date, v]) => ({ date, value: v.value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [table])
}

/* ── Mutations ── */

export function addPortfolioManual(date: string, value: number): string {
  const id = newId()
  store.setRow(T.portfolio, id, { date, value, ts: Date.now(), source: 'manual' })
  return id
}

export function addPortfolioFromT212(summary: T212Summary): string {
  const id = newId()
  const row: Cells = { date: todayISO(), value: summary.total, ts: Date.now(), source: 't212' }
  if (summary.free != null) row.free = summary.free
  if (summary.invested != null) row.invested = summary.invested
  if (summary.ppl != null) row.ppl = summary.ppl
  store.setRow(T.portfolio, id, row as Record<string, string | number | boolean>)
  return id
}

export function deletePortfolioEntry(id: string): void {
  store.delRow(T.portfolio, id)
}

/* ── Auto-sync ── */

const AUTO_SYNC_MIN_GAP_MS = 6 * 60 * 60 * 1000 // at most every 6h
let autoSyncInFlight = false

/**
 * Silently refresh the portfolio from the T212 proxy when the app opens,
 * if configured and the last synced entry is stale. Returns the new total
 * (for an optional toast) or null when skipped/failed.
 */
export async function maybeAutoSyncT212(): Promise<number | null> {
  if (autoSyncInFlight) return null
  const url = String(store.getValue('settings.t212ProxyUrl') ?? '')
  const secret = String(store.getValue('settings.t212ProxySecret') ?? '')
  if (!url || !secret) return null

  const table = store.getTable(T.portfolio)
  let lastT212 = 0
  for (const row of Object.values(table)) {
    if (row.source === 't212') lastT212 = Math.max(lastT212, Number(row.ts ?? 0))
  }
  if (Date.now() - lastT212 < AUTO_SYNC_MIN_GAP_MS) return null

  autoSyncInFlight = true
  try {
    const { fetchT212Summary } = await import('@/lib/t212')
    const summary = await fetchT212Summary(url, secret)
    addPortfolioFromT212(summary)
    return summary.total
  } catch {
    return null // silent — manual sync still shows errors
  } finally {
    autoSyncInFlight = false
  }
}
