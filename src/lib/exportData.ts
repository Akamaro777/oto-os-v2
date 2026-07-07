import { store } from '@/store/store'
import { todayISO } from './dates'

/** Download the full store (tables + values) as a JSON backup file. */
export function exportBackup(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'oto-os-v2',
    tables: store.getTables(),
    values: store.getValues(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oto-os-backup-${todayISO()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Restore a backup produced by exportBackup (v2 format). */
export function importBackup(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw == null) return false
  const data = raw as { app?: string; tables?: unknown; values?: unknown }
  if (data.app !== 'oto-os-v2' || typeof data.tables !== 'object') return false
  store.transaction(() => {
    store.setTables(data.tables as Parameters<typeof store.setTables>[0])
    if (data.values && typeof data.values === 'object') {
      store.setValues(data.values as Parameters<typeof store.setValues>[0])
    }
  })
  return true
}
