/**
 * Automatic versioned snapshots of the whole store, kept in a separate
 * IndexedDB database so a bad migration or corrupted store can't take the
 * backups down with it. One snapshot per week, last 8 kept.
 */
import { store } from '@/store/store'
import { todayISO } from './dates'

const DB_NAME = 'oto-os-backups'
const STORE = 'snapshots'
const KEEP = 12
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface Snapshot {
  id: number // Date.now() at creation
  date: string // YYYY-MM-DD
  json: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const db = await openDb()
  try {
    const all = await tx<Snapshot[]>(db, 'readonly', (s) => s.getAll() as IDBRequest<Snapshot[]>)
    return all.sort((a, b) => b.id - a.id)
  } finally {
    db.close()
  }
}

/** Take a snapshot if the newest one is a week old (or none exists). Silent on failure. */
export async function maybeSnapshot(): Promise<void> {
  try {
    const snapshots = await listSnapshots()
    const newest = snapshots[0]
    if (newest && Date.now() - newest.id < WEEK_MS) return
    await writeSnapshot(snapshots)
  } catch {
    // Backups must never break boot.
  }
}

/**
 * Take a snapshot right now (before sync overwrites un-pushed local edits, or
 * before a restore/import). Silent on failure — never blocks the caller's flow.
 */
export async function snapshotNow(): Promise<void> {
  try {
    await writeSnapshot(await listSnapshots())
  } catch {
    // Best-effort only.
  }
}

async function writeSnapshot(existing: Snapshot[]): Promise<void> {
  const json = JSON.stringify({ app: 'oto-os-v2', tables: store.getTables(), values: store.getValues() })
  const db = await openDb()
  try {
    await tx(db, 'readwrite', (s) => s.put({ id: Date.now(), date: todayISO(), json }))
    for (const old of existing.slice(KEEP - 1)) {
      await tx(db, 'readwrite', (s) => s.delete(old.id))
    }
  } finally {
    db.close()
  }
}

/** Save a snapshot to a file the user can keep anywhere. */
export function downloadSnapshot(snap: Snapshot): void {
  const blob = new Blob([snap.json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oto-os-backup-${snap.date}.json`
  a.click()
  // Deferred: revoking synchronously can abort the download on iOS Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
