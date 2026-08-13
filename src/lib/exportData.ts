import { store } from '@/store/store'
import { todayISO } from './dates'

/**
 * Live credentials never leave the device in a shareable file — backups get
 * passed around (AirDrop, cloud drives, seeds) and a leaked Anthropic key or
 * sync secret is a real incident. Sync payloads and on-device snapshots keep
 * them (that's how the other devices get configured); downloads don't.
 */
const SECRET_VALUE_KEYS = new Set([
  'settings.apiKey',
  'settings.jbKey',
  'settings.t212ProxySecret',
  'settings.syncSecret',
])

function valuesWithoutSecrets(): ReturnType<typeof store.getValues> {
  const values = { ...store.getValues() }
  for (const key of SECRET_VALUE_KEYS) delete values[key]
  return values
}

/** Download the full store (tables + values, minus secrets) as a JSON backup file. */
export function exportBackup(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'oto-os-v2',
    tables: store.getTables(),
    values: valuesWithoutSecrets(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oto-os-backup-${todayISO()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Deferred: revoking synchronously can abort the download on iOS Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Merge a data file into the store: every cell in the file is added/updated,
 * nothing existing is deleted (cell-level merge — a partial row in the file
 * leaves the row's other cells alone). Accepts full backups and partial seeds
 * (e.g. the GMAT error-log seed). Deterministic row ids make re-imports
 * idempotent. Secret settings are never taken from a file.
 */
export function mergeImport(raw: unknown): { rows: number; tables: string[] } | null {
  if (typeof raw !== 'object' || raw == null) return null
  const data = raw as {
    app?: string
    tables?: Record<string, Record<string, Record<string, unknown>>>
    values?: Record<string, unknown>
  }
  if (data.app !== 'oto-os-v2') return null
  if (typeof data.tables !== 'object' && typeof data.values !== 'object') return null
  let rows = 0
  const touched: string[] = []
  store.transaction(() => {
    let valuesSet = 0
    for (const [key, value] of Object.entries(data.values ?? {})) {
      if (SECRET_VALUE_KEYS.has(key)) continue
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        store.setValue(key, value)
        valuesSet++
      }
    }
    if (valuesSet) {
      rows += valuesSet
      touched.push('settings')
    }
    for (const [tableId, table] of Object.entries(data.tables ?? {})) {
      if (typeof table !== 'object' || table == null) continue
      let count = 0
      for (const [rowId, row] of Object.entries(table)) {
        if (typeof row !== 'object' || row == null) continue
        store.setPartialRow(tableId, rowId, row as Record<string, string | number | boolean>)
        count++
      }
      if (count) {
        rows += count
        touched.push(tableId)
      }
    }
  })
  return { rows, tables: touched }
}

/**
 * Full restore: replace the store with a backup produced by exportBackup or an
 * automatic snapshot (backups.ts). Destructive by design — callers confirm
 * first and take a pre-restore snapshot.
 */
export function importBackup(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw == null) return false
  const data = raw as { app?: string; tables?: unknown; values?: unknown }
  // Snapshots predating the `app` stamp have only { tables, values }.
  if (data.app !== undefined && data.app !== 'oto-os-v2') return false
  if (typeof data.tables !== 'object' || data.tables == null) return false
  store.transaction(() => {
    store.setTables(data.tables as Parameters<typeof store.setTables>[0])
    if (data.values && typeof data.values === 'object') {
      const values = data.values as Record<string, unknown>
      // Downloads carry no secrets — keep this device's keys instead of
      // blanking them to schema defaults.
      for (const key of SECRET_VALUE_KEYS) {
        if (values[key] === undefined) {
          const current = store.getValue(key)
          if (current !== undefined && current !== '') values[key] = current
        }
      }
      store.setValues(values as Parameters<typeof store.setValues>[0])
    }
  })
  return true
}
