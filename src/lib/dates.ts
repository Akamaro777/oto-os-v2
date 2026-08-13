/**
 * Date helpers. Dates are stored as local-time ISO strings 'YYYY-MM-DD' so they
 * compare lexically (a < b === a is earlier). date-fns handles richer
 * formatting/arithmetic used by the planner and beyond.
 */
import { addDays as fnsAddDays, format, parseISO, getISOWeek, getISOWeekYear } from 'date-fns'

/** Today as local 'YYYY-MM-DD'. */
export function todayISO(): string {
  return toISO(new Date())
}

/** Local 'YYYY-MM-DD' for a Date. */
export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Whole days between two ISO dates (b - a); positive if b is later. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)
  return Math.round(ms / 86_400_000)
}

/** Days since an ISO date until today (>= 0 in the past). Null if empty. */
export function daysSince(date?: string): number | null {
  if (!date) return null
  return daysBetween(date, todayISO())
}

/** Human relative label for a due date vs today. */
export function relativeDueLabel(due: string, today = todayISO()): string {
  const diff = daysBetween(today, due)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${-diff}d overdue`
  if (diff < 7) return `In ${diff}d`
  return due
}

/** Tomorrow as local ISO. */
export function tomorrowISO(): string {
  return addDaysISO(todayISO(), 1)
}

/** Shift an ISO date by whole days, returning ISO. */
export function addDaysISO(date: string, delta: number): string {
  return toISO(fnsAddDays(parseISO(date), delta))
}

/** Header label for a planner day: 'Today' / 'Tomorrow' / 'Mon, Jul 6'. */
export function dayHeaderLabel(date: string, today = todayISO()): string {
  if (date === today) return 'Today'
  if (date === addDaysISO(today, 1)) return 'Tomorrow'
  if (date === addDaysISO(today, -1)) return 'Yesterday'
  return safeFormat(date, 'EEE, MMM d')
}

/**
 * Format an ISO date, returning the raw string when it isn't a valid date.
 * Formatters run inside chart ticks and list rows — a malformed stored date
 * (bad import, hand-edited seed) must degrade to text, never throw mid-render.
 */
function safeFormat(date: string, fmt: string): string {
  try {
    return format(parseISO(date), fmt)
  } catch {
    return date
  }
}

/** Minutes since midnight for 'HH:MM'. */
export function parseHM(hm: string): number {
  const [h, m] = hm.split(':')
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

/** 'HH:MM' from minutes since midnight (supports 24:00). */
export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** ISO week key 'YYYY-Www' (matches v1's gymSessions keys). */
export function isoWeekKey(date: string = todayISO()): string {
  const d = parseISO(date)
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
}

/** Short label for a chart axis tick, e.g. 'Jul 6'. Total — bad input echoes back. */
export function shortDate(date: string): string {
  return safeFormat(date, 'MMM d')
}
