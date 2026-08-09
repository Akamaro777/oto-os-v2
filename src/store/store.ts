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
    const persister = createIndexedDbPersister(store, DB_NAME)
    bootPromise = persister
      .startAutoLoad()
      .then(() => persister.startAutoSave())
      .then(() => runMigrations())
      .then(() => {
        // Weekly safety snapshot, after the real data has loaded.
        void import('@/lib/backups').then((m) => m.maybeSnapshot())
      })
  }
  return bootPromise
}
