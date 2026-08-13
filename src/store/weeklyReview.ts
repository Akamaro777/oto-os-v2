import { useCell } from 'tinybase/ui-react'
import { store } from './store'
import { T } from './schema'

/**
 * The Sunday AI verdict, persisted per ISO week so a paid API result survives
 * tab switches and syncs across devices; past weeks become a review journal.
 */
export function useWeeklyVerdict(week: string): string {
  return String(useCell(T.weeklyReviews, week, 'text', store) ?? '')
}

export function saveWeeklyVerdict(week: string, text: string): void {
  store.setRow(T.weeklyReviews, week, { week, text, ts: Date.now() })
}
