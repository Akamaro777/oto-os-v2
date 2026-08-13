import { createStore, type Store } from 'tinybase'
import { createIndexedDbPersister } from 'tinybase/persisters/persister-indexed-db'
import { tablesSchema, valuesSchema } from './schema'
import { runMigrations } from './migrations'

export const DB_NAME = 'oto-os'

/** The single source of truth. UI reacts to this via tinybase/ui-react hooks. */
export const store: Store = createStore()
  .setTablesSchema(tablesSchema)
  .setValuesSchema(valuesSchema)

let bootPromise: Promise<void> | null = null

/**
 * Load persisted data from IndexedDB and begin auto-saving future changes.
 * Idempotent — safe under React StrictMode's double-invoke.
 */
export function initPersistence(): Promise<void> {
  if (!bootPromise) {
    const persister = createIndexedDbPersister(store, DB_NAME, 1, (error) => {
      // Persist errors are otherwise swallowed by TinyBase — at least log them.
      console.error('[oto-os] persister error', error)
    })
    // If the load fails, the chain rejects BEFORE auto-save starts — never
    // arm auto-save over a store that didn't load (it would overwrite good
    // data with an empty store). StoreProvider surfaces the failure.
    bootPromise = persister
      .startAutoLoad()
      .then(async () => {
        // Weekly safety snapshot — taken before migrations so a bad migration
        // can never poison the only recent backup.
        await import('@/lib/backups').then((m) => m.maybeSnapshot())
      })
      .then(() => persister.startAutoSave())
      .then(() => runMigrations())
  }
  return bootPromise
}

// Handy for the console and for driving headless smoke tests in dev.
if (import.meta.env.DEV) {
  ;(window as unknown as { store: Store }).store = store
}
