import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { getDaysInMonth, parseISO } from 'date-fns'
import { store } from './store'
import { T } from './schema'
import { getProfileNumber } from './profile'

type Cells = Record<string, string | number | boolean | undefined>

/* ── Mutations ── */

export function setWalletBalance(date: string, balance: number): void {
  store.setPartialRow(T.wallet, date, { balance, ts: Date.now() })
}

export function setWalletSpent(date: string, spent: number): void {
  store.setPartialRow(T.wallet, date, { spent, ts: Date.now() })
}

/* ── Month view ── */

export type BudgetPace = 'ahead' | 'ontrack' | 'behind'

export interface WalletMonth {
  budget: number
  /** Latest known balance (money left), null before the first sync/entry. */
  left: number | null
  /** Date of that latest balance. */
  lastDate: string | null
  /** Today's outgoings — statement figure, else balance drop vs the previous snapshot. */
  spentToday: number | null
  /** Spent so far this month (statement sum, else budget − left, floored at 0). */
  spentMonth: number | null
  /** left ÷ days remaining (incl. today). */
  dailyAllowance: number | null
  daysRemaining: number
  /** Where a perfectly linear month would be right now. */
  expectedLeft: number
  pace: BudgetPace | null
  /** Balance per day this month, oldest first — for the burn-down trend. */
  series: { date: string; value: number }[]
}

export function useWalletMonth(today: string): WalletMonth {
  const table = useTable(T.wallet, store) as Record<string, Cells>
  const budget = getProfileNumber('monthlyBudget') || 1700

  return useMemo(() => {
    const monthPrefix = today.slice(0, 7)
    const day = parseISO(today)
    const daysInMonth = getDaysInMonth(day)
    const dayOfMonth = Number(today.slice(8, 10))
    const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1)
    const expectedLeft = (budget * (daysInMonth - dayOfMonth + 1)) / daysInMonth

    // Balance entries up to today, oldest first (past months included so the
    // first sync of a new month still has a "previous" point for the delta).
    const balances = Object.entries(table)
      .filter(([date, row]) => date <= today && row.balance != null)
      .map(([date, row]) => ({ date, balance: Number(row.balance) }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const latest = balances[balances.length - 1] ?? null
    const left = latest ? latest.balance : null

    // Statement-based spend for this month, when the proxy provides it.
    const spentDays = Object.entries(table)
      .filter(([date, row]) => date.startsWith(monthPrefix) && date <= today && row.spent != null)
      .map(([date, row]) => ({ date, spent: Number(row.spent) }))
    const statementToday = spentDays.find((s) => s.date === today)?.spent ?? null

    let spentToday: number | null = statementToday
    if (spentToday == null && latest?.date === today && balances.length >= 2) {
      const prev = balances[balances.length - 2]
      spentToday = Math.max(0, prev.balance - latest.balance)
    }

    const spentMonth = spentDays.length
      ? spentDays.reduce((a, s) => a + s.spent, 0)
      : left != null
        ? Math.max(0, budget - left)
        : null

    const dailyAllowance = left != null ? Math.max(0, left) / daysRemaining : null

    // 5%-of-budget tolerance band around the linear burn line.
    const pace: BudgetPace | null =
      left == null
        ? null
        : left >= expectedLeft - budget * 0.05
          ? left >= expectedLeft + budget * 0.05
            ? 'ahead'
            : 'ontrack'
          : 'behind'

    const series = balances
      .filter((b) => b.date.startsWith(monthPrefix))
      .map((b) => ({ date: b.date, value: b.balance }))

    return {
      budget,
      left,
      lastDate: latest?.date ?? null,
      spentToday,
      spentMonth,
      dailyAllowance,
      daysRemaining,
      expectedLeft,
      pace,
      series,
    }
  }, [table, today, budget])
}
