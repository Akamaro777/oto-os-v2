import type { Contact } from '@/store/schema'
import { todayISO, daysBetween } from './dates'

/** True when a contact has a cadence and enough days have passed since last touch. */
export function reconnectDue(c: Contact, today = todayISO()): boolean {
  if (!c.cadenceDays || !c.lastContact) return false
  return daysBetween(c.lastContact, today) >= c.cadenceDays
}

/** Days until the contact's next birthday (accepts 'MM-DD' or 'YYYY-MM-DD'); null if none/invalid. */
export function daysUntilBirthday(c: Contact, today = todayISO()): number | null {
  if (!c.birthday) return null
  const orig = c.birthday.length > 5 ? c.birthday.slice(5) : c.birthday
  if (!/^\d{2}-\d{2}$/.test(orig)) return null
  const tY = Number(today.slice(0, 4))
  // Feb 29 in a non-leap year parses as NaN and the birthday would never
  // surface — celebrate on Feb 28 those years.
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const inYear = (y: number) => (orig === '02-29' && !isLeap(y) ? '02-28' : orig)
  const thisYear = Date.parse(`${tY}-${inYear(tY)}T00:00:00`)
  const nowMs = Date.parse(`${today}T00:00:00`)
  if (Number.isNaN(thisYear)) return null
  let diff = Math.round((thisYear - nowMs) / 86_400_000)
  if (diff < 0) {
    const nextYear = Date.parse(`${tY + 1}-${inYear(tY + 1)}T00:00:00`)
    diff = Math.round((nextYear - nowMs) / 86_400_000)
  }
  return diff
}

/** True when the contact's birthday is within the next 7 days. */
export function birthdaySoon(c: Contact, today = todayISO()): boolean {
  const d = daysUntilBirthday(c, today)
  return d != null && d >= 0 && d <= 7
}

/** Human label for last-contact recency. */
export function lastContactLabel(c: Contact, today = todayISO()): string {
  if (!c.lastContact) return 'never logged'
  const ds = daysBetween(c.lastContact, today)
  if (ds <= 0) return 'today'
  if (ds === 1) return 'yesterday'
  return `${ds}d ago`
}
