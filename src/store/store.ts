import { createMergeableStore, type MergeableStore } from 'tinybase'
import { createLocalPersister } from 'tinybase/persisters/persister-browser'
import { tablesSchema, valuesSchema } from './schema'
import { runMigrations } from './migrations'

export const DB_NAME = 'oto-os'

/**
 * The single source of truth. A CRDT MergeableStore, so two devices editing
 * concurrently merge at cell level over the WebSocket synchronizer (see
 * lib/syncWs.ts) instead of one side's whole snapshot winning.
 * Persisted to localStorage — TinyBase's IndexedDB persister can't carry the
 * CRDT metadata; the store is ~100KB, far under the localStorage cap.
 */
export const store: MergeableStore = createMergeableStore()
  .setTablesSchema(tablesSchema)
  .setValuesSchema(valuesSchema)

let bootPromise: Promise<void> | null = null

/**
 * Publish the device's IANA zone so the reminder cron can turn an event's wall
 * time ("08:00") into a real instant. Written on every boot, so flying
 * somewhere and opening the app is all it takes to re-aim the reminders.
 */
function recordTimezone(): void {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (tz && store.getValue('profile.timezone') !== tz) {
    store.setValue('profile.timezone', tz)
  }
}

/**
 * Load persisted data and begin auto-saving future changes.
 * Idempotent — safe under React StrictMode's double-invoke.
 */
export function initPersistence(): Promise<void> {
  if (!bootPromise) {
    const persister = createLocalPersister(store, DB_NAME, (error) => {
      // Persist errors are otherwise swallowed by TinyBase — at least log them.
      console.error('[oto-os] persister error', error)
    })
    // If the load fails, the chain rejects BEFORE auto-save starts — never
    // arm auto-save over a store that didn't load (it would overwrite good
    // data with an empty store). StoreProvider surfaces the failure.
    bootPromise = persister
      .startAutoLoad()
      .then(async () => {
        // One-time migration from the pre-CRDT IndexedDB persistence.
        if (Object.keys(store.getTables()).length === 0) {
          await importLegacyIndexedDb()
        }
      })
      .then(async () => {
        // Weekly safety snapshot — taken before migrations so a bad migration
        // can never poison the only recent backup.
        await import('@/lib/backups').then((m) => m.maybeSnapshot())
      })
      .then(() => persister.startAutoSave())
      .then(() => runMigrations())
      .then(() => recordTimezone())
  }
  return bootPromise
}

/**
 * Read the old TinyBase IndexedDB persistence (object stores 't' and 'v',
 * entries shaped {k, v}) and seed the new store from it. The old database is
 * left in place as a safety copy.
 */
async function importLegacyIndexedDb(): Promise<void> {
  try {
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      // upgradeneeded firing means the DB didn't exist — nothing to migrate.
      const req = indexedDB.open(DB_NAME)
      req.onupgradeneeded = () => {
        req.transaction?.abort()
        resolve(null)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })
    if (!db) return
    if (!db.objectStoreNames.contains('t') || !db.objectStoreNames.contains('v')) {
      db.close()
      return
    }
    const readAll = (storeName: string) =>
      new Promise<{ k: string; v: unknown }[]>((resolve, reject) => {
        const req = db.transaction(storeName).objectStore(storeName).getAll()
        req.onsuccess = () => resolve(req.result as { k: string; v: unknown }[])
        req.onerror = () => reject(req.error)
      })
    const [tableRows, valueRows] = await Promise.all([readAll('t'), readAll('v')])
    db.close()

    const tables: Record<string, unknown> = {}
    for (const { k, v } of tableRows) tables[k] = v
    const values: Record<string, unknown> = {}
    for (const { k, v } of valueRows) values[k] = v
    if (Object.keys(tables).length === 0 && Object.keys(values).length === 0) return

    store.transaction(() => {
      store.setTables(tables as Parameters<typeof store.setTables>[0])
      store.setValues(values as Parameters<typeof store.setValues>[0])
    })
    console.info('[oto-os] migrated data from IndexedDB to the CRDT store')
  } catch (err) {
    console.error('[oto-os] legacy IndexedDB migration failed', err)
  }
}

// Handy for the console and for driving headless smoke tests in dev.
if (import.meta.env.DEV) {
  ;(window as unknown as { store: MergeableStore }).store = store
}
