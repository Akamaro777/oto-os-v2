import { useMemo } from 'react'
import { useTable, useValues } from 'tinybase/ui-react'
import { store } from '@/store/store'
import { T } from '@/store/schema'
import { getProfileNumber } from '@/store/profile'
import { addDaysISO } from './dates'

export interface Streak {
  current: number
  best: number
}

/**
 * Streak math over a set of "hit" dates. The current streak counts back from
 * today; today itself is optional (an unfinished today must not show 0).
 */
export function computeStreak(hitDates: Set<string>, today: string): Streak {
  let current = 0
  let cursor = hitDates.has(today) ? today : addDaysISO(today, -1)
  while (hitDates.has(cursor)) {
    current++
    cursor = addDaysISO(cursor, -1)
  }

  // Best run: walk sorted dates, counting consecutive-day chains.
  const sorted = [...hitDates].sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of sorted) {
    run = prev && addDaysISO(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return { current, best }
}

export interface StreakSet {
  deepwork: Streak
  calls: Streak
  logging: Streak
}

/** The three streaks that matter: deep work done, calls target hit, anything logged. */
export function useStreaks(today: string): StreakSet {
  const rules = useTable(T.rules, store)
  const cv = useTable(T.cv, store)
  useValues(store)
  return useMemo(() => {
    const callsTarget = getProfileNumber('callsDailyTarget') || 70

    const deepworkDays = new Set<string>()
    for (const [date, row] of Object.entries(rules)) {
      if (row.deepwork === true) deepworkDays.add(date)
    }

    const callDays = new Set<string>()
    const loggedDays = new Set<string>()
    for (const [date, row] of Object.entries(cv)) {
      if (Number(row.calls ?? 0) >= callsTarget) callDays.add(date)
      if (Number(row.studyHours ?? 0) > 0 || Number(row.calls ?? 0) > 0) loggedDays.add(date)
    }
    // A deep-work tick also counts as "showed up".
    for (const d of deepworkDays) loggedDays.add(d)

    return {
      deepwork: computeStreak(deepworkDays, today),
      calls: computeStreak(callDays, today),
      logging: computeStreak(loggedDays, today),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, cv, today])
}
