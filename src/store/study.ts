import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type CvLog, type MockExam, type GmatError } from './schema'
import { newId } from '@/lib/ids'
import { todayISO, addDaysISO } from '@/lib/dates'

type Cells = Record<string, string | number | boolean | undefined>

/* ── Daily study log (cv table) ── */

function rowToCvLog(date: string, row: Cells): CvLog {
  return {
    date,
    problems: row.problems != null ? Number(row.problems) : undefined,
    correct: row.correct != null ? Number(row.correct) : undefined,
    time: row.time != null ? Number(row.time) : undefined,
    topic: row.topic ? String(row.topic) : undefined,
    studyHours: row.studyHours != null ? Number(row.studyHours) : undefined,
    linkedin: row.linkedin != null ? Number(row.linkedin) : undefined,
    calls: row.calls != null ? Number(row.calls) : undefined,
    netNotes: row.netNotes ? String(row.netNotes) : undefined,
  }
}

export function useCvLog(date: string): CvLog | undefined {
  const table = useTable(T.cv, store) as Record<string, Cells>
  return useMemo(() => {
    const row = table[date]
    return row ? rowToCvLog(date, row) : undefined
  }, [table, date])
}

export function setStudyHours(date: string, hours: number): void {
  const h = Math.max(0, hours)
  if (h === 0) store.delCell(T.cv, date, 'studyHours')
  else store.setCell(T.cv, date, 'studyHours', h)
}

export type PracticeField = 'problems' | 'correct' | 'time'

export function setPracticeNumber(date: string, field: PracticeField, value: string): void {
  const n = Number(value)
  if (value === '' || Number.isNaN(n)) store.delCell(T.cv, date, field)
  else store.setCell(T.cv, date, field, n)
}

/** Cold calls done on a date (stored on the cv daily log; the money pillar reads it too). */
export function setColdCalls(date: string, count: number): void {
  const n = Math.max(0, Math.round(count))
  if (n === 0) store.delCell(T.cv, date, 'calls')
  else store.setCell(T.cv, date, 'calls', n)
}

/** Cold calls per day for the trend chart (last `days` ending at `anchor`). */
export function useColdCallsSeries(days = 7, anchor = todayISO()): { date: string; value: number }[] {
  const table = useTable(T.cv, store) as Record<string, Cells>
  return useMemo(() => {
    const out: { date: string; value: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysISO(anchor, -i)
      out.push({ date, value: Number(table[date]?.calls ?? 0) })
    }
    return out
  }, [table, days, anchor])
}

/** date → cold calls, for the consistency heatmap. */
export function useColdCallsMap(): Record<string, number> {
  const table = useTable(T.cv, store) as Record<string, Cells>
  return useMemo(() => {
    const out: Record<string, number> = {}
    for (const [date, row] of Object.entries(table)) {
      const n = Number(row.calls ?? 0)
      if (n > 0) out[date] = n
    }
    return out
  }, [table])
}

export function setPracticeTopic(date: string, topic: string): void {
  if (topic.trim()) store.setCell(T.cv, date, 'topic', topic.trim())
  else store.delCell(T.cv, date, 'topic')
}

export function useStudySeries(days = 7, anchor = todayISO()): { date: string; value: number }[] {
  const table = useTable(T.cv, store) as Record<string, Cells>
  return useMemo(() => {
    const out: { date: string; value: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysISO(anchor, -i)
      out.push({ date, value: Number(table[date]?.studyHours ?? 0) })
    }
    return out
  }, [table, days, anchor])
}

/** date → study hours (falls back to time-on-problems), for the heatmap. */
export function useStudyHoursMap(): Record<string, number> {
  const table = useTable(T.cv, store) as Record<string, Cells>
  return useMemo(() => {
    const out: Record<string, number> = {}
    for (const [date, row] of Object.entries(table)) {
      const h = Number(row.studyHours ?? 0) || Number(row.time ?? 0) / 60
      if (h > 0) out[date] = h
    }
    return out
  }, [table])
}

/* ── Mock exams ── */

function rowToMock(id: string, row: Cells): MockExam {
  return {
    id,
    date: String(row.date ?? ''),
    score: Number(row.score ?? 0),
    ts: Number(row.ts ?? 0),
  }
}

export function useMockExams(): MockExam[] {
  const table = useTable(T.mockExams, store) as Record<string, Cells>
  return useMemo(
    () => Object.entries(table).map(([id, row]) => rowToMock(id, row)).sort((a, b) => a.date.localeCompare(b.date)),
    [table],
  )
}

export function addMockExam(date: string, score: number): string {
  const id = newId()
  store.setRow(T.mockExams, id, { date, score, ts: Date.now() })
  return id
}

export function deleteMockExam(id: string): void {
  store.delRow(T.mockExams, id)
}

/* ── GMAT error log (one row per wrong question) ── */

export const GMAT_SECTIONS = ['quant', 'verbal', 'di'] as const
export const GMAT_REASONS = ['concept', 'careless', 'time'] as const

function rowToError(id: string, row: Cells): GmatError {
  return {
    id,
    date: String(row.date ?? ''),
    section: String(row.section ?? 'quant'),
    topic: String(row.topic ?? ''),
    reason: String(row.reason ?? ''),
    note: row.note ? String(row.note) : undefined,
    ts: Number(row.ts ?? 0),
  }
}

export function useGmatErrors(): GmatError[] {
  const table = useTable(T.gmatErrors, store) as Record<string, Cells>
  return useMemo(
    () => Object.entries(table).map(([id, row]) => rowToError(id, row)).sort((a, b) => b.date.localeCompare(a.date)),
    [table],
  )
}

export interface GmatErrorInput {
  date: string
  section: string
  topic: string
  reason?: string
  note?: string
}

export function addGmatError(input: GmatErrorInput): string {
  const id = newId()
  const row: Cells = {
    date: input.date,
    section: (GMAT_SECTIONS as readonly string[]).includes(input.section) ? input.section : 'quant',
    topic: input.topic.trim().toLowerCase(),
    reason: (GMAT_REASONS as readonly string[]).includes(input.reason ?? '') ? (input.reason as string) : '',
    ts: Date.now(),
  }
  if (input.note?.trim()) row.note = input.note.trim()
  store.setRow(T.gmatErrors, id, row as Record<string, string | number | boolean>)
  return id
}

export function deleteGmatError(id: string): void {
  store.delRow(T.gmatErrors, id)
}

export interface WeakSpot {
  topic: string
  section: string
  total: number
  byReason: Record<string, number>
}

/** Error counts grouped by topic, worst first — the Weak Spots aggregation. */
export function aggregateWeakSpots(errors: GmatError[]): WeakSpot[] {
  const map = new Map<string, WeakSpot>()
  for (const e of errors) {
    if (!e.topic) continue
    const key = `${e.section}:${e.topic}`
    const spot = map.get(key) ?? { topic: e.topic, section: e.section, total: 0, byReason: {} }
    spot.total++
    const reason = e.reason || 'unknown'
    spot.byReason[reason] = (spot.byReason[reason] ?? 0) + 1
    map.set(key, spot)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}
