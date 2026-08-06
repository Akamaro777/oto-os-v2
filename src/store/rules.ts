import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type RulesLog } from './schema'

type Cells = Record<string, string | number | boolean | undefined>

/** Reactive daily non-negotiables checklist for a date (rowId = date). */
export function useRules(date: string): RulesLog {
  const table = useTable(T.rules, store) as Record<string, Cells>
  return useMemo(() => {
    const row = table[date] ?? {}
    return {
      date,
      deepwork: Boolean(row.deepwork),
      noon: Boolean(row.noon),
      calls: Boolean(row.calls),
      run: Boolean(row.run),
    }
  }, [table, date])
}

export type RuleKey = 'deepwork' | 'noon' | 'calls' | 'run'

export function toggleRule(date: string, key: RuleKey): void {
  const current = Boolean(store.getCell(T.rules, date, key))
  store.setCell(T.rules, date, key, !current)
}
