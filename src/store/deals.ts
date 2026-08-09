import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type Deal } from './schema'
import { newId } from '@/lib/ids'

type Cells = Record<string, string | number | boolean | undefined>

export const DEAL_STATUSES = ['lead', 'talking', 'closed', 'lost'] as const
export type DealStatus = (typeof DEAL_STATUSES)[number]

function rowToDeal(id: string, row: Cells): Deal {
  return {
    id,
    name: String(row.name ?? ''),
    mrr: Number(row.mrr ?? 0),
    status: String(row.status ?? 'lead'),
    notes: row.notes ? String(row.notes) : undefined,
    ts: Number(row.ts ?? 0),
  }
}

/** Reactive list of all deals, newest first. */
export function useAllDeals(): Deal[] {
  const table = useTable(T.deals, store) as Record<string, Cells>
  return useMemo(
    () => Object.entries(table).map(([id, row]) => rowToDeal(id, row)).sort((a, b) => b.ts - a.ts),
    [table],
  )
}

/** Live monthly recurring revenue = sum of closed deals. */
export function useLiveMrr(): number {
  const deals = useAllDeals()
  return useMemo(
    () => deals.filter((d) => d.status === 'closed').reduce((sum, d) => sum + d.mrr, 0),
    [deals],
  )
}

export interface DealInput {
  name: string
  mrr: number
  status: string
  notes?: string
}

export function createDeal(input: DealInput): string {
  const id = newId()
  const row: Cells = {
    name: input.name.trim(),
    mrr: Math.max(0, input.mrr),
    status: (DEAL_STATUSES as readonly string[]).includes(input.status) ? input.status : 'lead',
    ts: Date.now(),
  }
  if (input.notes?.trim()) row.notes = input.notes.trim()
  store.setRow(T.deals, id, row as Record<string, string | number | boolean>)
  return id
}

export function updateDeal(id: string, patch: Partial<DealInput>): void {
  if (patch.name != null) store.setCell(T.deals, id, 'name', patch.name.trim())
  if (patch.mrr != null) store.setCell(T.deals, id, 'mrr', Math.max(0, patch.mrr))
  if (patch.status != null && (DEAL_STATUSES as readonly string[]).includes(patch.status))
    store.setCell(T.deals, id, 'status', patch.status)
  if (patch.notes != null) {
    if (patch.notes.trim()) store.setCell(T.deals, id, 'notes', patch.notes.trim())
    else store.delCell(T.deals, id, 'notes')
  }
}

export function deleteDeal(id: string): void {
  store.delRow(T.deals, id)
}
