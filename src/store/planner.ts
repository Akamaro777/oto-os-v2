import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type Block } from './schema'
import { newId } from '@/lib/ids'
import { parseHM } from '@/lib/dates'

type Cells = Record<string, string | number | boolean | undefined>

function rowToBlock(id: string, row: Cells): Block {
  return {
    id,
    date: String(row.date ?? ''),
    start: String(row.start ?? '09:00'),
    end: row.end ? String(row.end) : '',
    title: String(row.title ?? ''),
    category: row.category ? String(row.category) : undefined,
    done: Boolean(row.done),
    taskId: row.taskId ? String(row.taskId) : undefined,
  }
}

/** Blocks for a day, sorted by start time. */
export function useBlocksByDate(date: string): Block[] {
  const table = useTable(T.blocks, store) as Record<string, Cells>
  return useMemo(
    () =>
      Object.entries(table)
        .map(([id, row]) => rowToBlock(id, row))
        .filter((b) => b.date === date)
        .sort((a, b) => parseHM(a.start) - parseHM(b.start)),
    [table, date],
  )
}

export interface NowNext {
  now?: Block
  next?: Block
}

/** The block covering `nowMin`, and the next upcoming block, from a day's blocks. */
export function computeNowNext(blocks: Block[], nowMin: number): NowNext {
  let now: Block | undefined
  let next: Block | undefined
  for (const b of blocks) {
    const start = parseHM(b.start)
    const rawEnd = b.end ? parseHM(b.end) : start + 60
    // An end before the start means the block crosses midnight (23:30–00:30).
    const end = rawEnd <= start ? rawEnd + 24 * 60 : rawEnd
    if (start <= nowMin && nowMin < end) now = b
    else if (start > nowMin && (!next || parseHM(next.start) > start)) next = b
  }
  return { now, next }
}

/* ── Top 3 (three text slots per day; taskId optional) ── */

function top3RowId(date: string, slot: number): string {
  return `${date}:${slot}`
}

/** The three Top-3 texts for a day, always length 3. */
export function useTop3(date: string): string[] {
  const table = useTable(T.top3, store) as Record<string, Cells>
  return useMemo(() => {
    const out = ['', '', '']
    for (const row of Object.values(table)) {
      if (row.date === date) {
        const slot = Number(row.slot ?? 0)
        if (slot >= 0 && slot < 3) out[slot] = String(row.text ?? '')
      }
    }
    return out
  }, [table, date])
}

export function setTop3(date: string, slot: number, text: string): void {
  const id = top3RowId(date, slot)
  const trimmed = text.trim()
  if (!trimmed) {
    store.delRow(T.top3, id)
    return
  }
  // Preserve a task link (v1 import) — setRow would silently drop the cell.
  const taskId = store.getCell(T.top3, id, 'taskId')
  const row: Record<string, string | number> = { date, slot, text: trimmed }
  if (typeof taskId === 'string' && taskId) row.taskId = taskId
  store.setRow(T.top3, id, row)
}

/* ── Block mutations ── */

export interface BlockInput {
  title: string
  start: string
  end?: string
  category?: string
  taskId?: string
}

export function createBlock(date: string, input: BlockInput): string {
  const id = newId()
  const row: Cells = {
    date,
    title: input.title.trim(),
    start: input.start || '09:00',
    done: false,
  }
  if (input.end) row.end = input.end
  if (input.category) row.category = input.category
  if (input.taskId) row.taskId = input.taskId
  store.setRow(T.blocks, id, row as Record<string, string | number | boolean>)
  return id
}

export function updateBlock(id: string, patch: BlockInput): void {
  store.setCell(T.blocks, id, 'title', patch.title.trim())
  store.setCell(T.blocks, id, 'start', patch.start || '09:00')
  if (patch.end) store.setCell(T.blocks, id, 'end', patch.end)
  else store.delCell(T.blocks, id, 'end')
  if (patch.category) store.setCell(T.blocks, id, 'category', patch.category)
  else store.delCell(T.blocks, id, 'category')
  if (patch.taskId) store.setCell(T.blocks, id, 'taskId', patch.taskId)
  else store.delCell(T.blocks, id, 'taskId')
}

export function toggleBlock(id: string): void {
  store.setCell(T.blocks, id, 'done', !store.getCell(T.blocks, id, 'done'))
}

export function deleteBlock(id: string): void {
  store.delRow(T.blocks, id)
}

/* ──────────────────────────────────────────────────────────────────────────
 * Overlap layout: assign each timed item to a lane so overlapping items sit
 * side-by-side. Returns lane index + lane count per cluster.
 * ────────────────────────────────────────────────────────────────────────── */

export interface TimedItem {
  id: string
  startMin: number
  endMin: number
}

export interface LaidOut<T extends TimedItem> {
  item: T
  lane: number
  lanes: number
}

export function layoutColumns<T extends TimedItem>(items: T[]): LaidOut<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const result: LaidOut<T>[] = []
  let cluster: { item: T; lane: number }[] = []
  let clusterEnd = -1

  const flush = () => {
    const lanes = cluster.reduce((max, c) => Math.max(max, c.lane + 1), 0)
    for (const c of cluster) result.push({ item: c.item, lane: c.lane, lanes })
    cluster = []
  }

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) flush()
    // find the first free lane in the current cluster
    const used = new Set(
      cluster.filter((c) => c.item.endMin > item.startMin).map((c) => c.lane),
    )
    let lane = 0
    while (used.has(lane)) lane++
    cluster.push({ item, lane })
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  flush()
  return result
}
