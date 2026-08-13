import { useEffect, useRef, useState } from 'react'
import { todayISO } from './dates'

/**
 * Reactive "today" — the local YYYY-MM-DD that actually rolls over.
 *
 * iOS restores the installed PWA from memory without a reload, so a
 * `useState(todayISO())` captured at mount can be days old by the time the
 * user taps something, silently writing logs onto the wrong date. This hook
 * re-checks on every foreground and once a minute while visible.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO)

  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()))
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    const interval = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}

/**
 * A user-steppable date that starts on today and follows the midnight
 * rollover — but only while the user is actually sitting on "today", so
 * browsing another day never gets yanked away.
 */
export function useSelectedDate(): [string, (date: string) => void] {
  const today = useToday()
  const [date, setDate] = useState(today)
  const lastToday = useRef(today)

  useEffect(() => {
    if (today !== lastToday.current) {
      const previous = lastToday.current
      lastToday.current = today
      setDate((d) => (d === previous ? today : d))
    }
  }, [today])

  return [date, setDate]
}
