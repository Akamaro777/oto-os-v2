import { useValue } from 'tinybase/ui-react'
import { store } from './store'
import { parseHM } from '@/lib/dates'

/** Read a profile.* number value (non-reactive). */
export function getProfileNumber(key: string): number {
  return Number(store.getValue(`profile.${key}`) ?? 0)
}

/** Read a profile.* string value (non-reactive). */
export function getProfileString(key: string): string {
  return String(store.getValue(`profile.${key}`) ?? '')
}

export interface DayWindow {
  startH: number
  endH: number
}

/** The planner's visible hour window from profile.dayStart/dayEnd. */
export function useDayWindow(): DayWindow {
  const start = useValue('profile.dayStart', store) as string | undefined
  const end = useValue('profile.dayEnd', store) as string | undefined
  const startH = Math.floor(parseHM(start ?? '07:00') / 60)
  let endH = Math.floor(parseHM(end ?? '24:00') / 60)
  if (endH <= startH) endH = 24
  return { startH, endH }
}
