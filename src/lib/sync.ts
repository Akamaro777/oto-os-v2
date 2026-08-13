/**
 * Cross-device sync (v1-style, last-write-wins snapshots).
 * The app mirrors the whole store to a tiny Cloudflare Worker (see workers/)
 * guarded by a shared secret: push (debounced) on local change, pull on open
 * and whenever the app returns to the foreground.
 *
 * Safety rails (each has bitten a real device at least in theory):
 * - Adoption: a device that has never synced against this URL must pull and
 *   adopt the server state before it is allowed to push, so a freshly
 *   configured device can't overwrite the good snapshot with its near-empty
 *   store 4 seconds after the secret is pasted in.
 * - Background flush: iOS freezes timers when the PWA is backgrounded, which
 *   strands the debounced push; pending changes are flushed on `hidden`, and
 *   un-pushed changes are re-sent after every foreground pull.
 * - A remote snapshot with zero rows never replaces local data, and a local
 *   backup snapshot is taken before remote data overwrites un-pushed edits.
 */
import { useEffect, useState } from 'react'
import { store } from '@/store/store'
import { getSetting } from '@/store/settings'
import { snapshotNow } from '@/lib/backups'
import { tablesSchema, valuesSchema } from '@/store/schema'

const LM_KEY = 'oto-sync-lastModified'
const PUSHED_KEY = 'oto-sync-lastPushed'
const ADOPTED_KEY = 'oto-sync-adopted'
const LAST_OK_KEY = 'oto-sync-lastOk'
const PUSH_DEBOUNCE_MS = 4000

/**
 * Grows whenever the schema gains tables/values. A snapshot stamped with a
 * bigger number came from a newer build than this one — applying it would
 * silently drop the cells this build doesn't know, and pushing ours back
 * would destroy them on the server too. So we do neither until the service
 * worker updates us.
 */
const SCHEMA_SIZE = Object.keys(tablesSchema).length * 1000 + Object.keys(valuesSchema).length

let started = false
let applyingRemote = false
let remoteAhead = false
let pushTimer: ReturnType<typeof setTimeout> | undefined
let pulling: Promise<boolean> | null = null

function configured(): boolean {
  return getSetting('syncUrl').length > 0 && getSetting('syncSecret').length > 0
}

function base(): string {
  return getSetting('syncUrl').replace(/\/$/, '')
}

function getLocalLM(): number {
  return Number(localStorage.getItem(LM_KEY) ?? 0)
}

function setLocalLM(ts: number): void {
  localStorage.setItem(LM_KEY, String(ts))
}

function getLastPushed(): number {
  return Number(localStorage.getItem(PUSHED_KEY) ?? 0)
}

function setLastPushed(ts: number): void {
  localStorage.setItem(PUSHED_KEY, String(ts))
}

/** Adoption is per sync URL, so pointing at a different worker re-adopts. */
function adoptedKey(): string {
  return `${ADOPTED_KEY}:${getSetting('syncUrl')}`
}

function isAdopted(): boolean {
  return localStorage.getItem(adoptedKey()) === '1'
}

function markAdopted(): void {
  localStorage.setItem(adoptedKey(), '1')
}

function countRows(tables: Record<string, Record<string, unknown>>): number {
  return Object.values(tables).reduce((n, rows) => n + Object.keys(rows).length, 0)
}

/** True if there are local changes the server hasn't confirmed receiving. */
function hasUnpushed(): boolean {
  return getLocalLM() > getLastPushed()
}

/** Epoch ms of the last successful push or pull, for the Settings status line. */
export function lastSyncOk(): number {
  return Number(localStorage.getItem(LAST_OK_KEY) ?? 0)
}

export type SyncHealth = 'off' | 'ok' | 'pending'

/**
 * Reactive sync health for the UI: 'pending' means local changes exist that
 * the server hasn't confirmed for over 2 minutes — the signal that sync has
 * silently died (rotated secret, offline) and data is diverging.
 */
export function useSyncHealth(): SyncHealth {
  const [health, setHealth] = useState<SyncHealth>('off')
  useEffect(() => {
    const check = () => {
      if (!configured()) return setHealth('off')
      const stale = hasUnpushed() && Date.now() - getLocalLM() > 2 * 60_000
      setHealth(stale ? 'pending' : 'ok')
    }
    check()
    const t = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return health
}

function markSyncOk(): void {
  localStorage.setItem(LAST_OK_KEY, String(Date.now()))
}

async function push(): Promise<void> {
  if (!configured() || remoteAhead) return
  // Never push from a device that hasn't adopted the server state: pull first.
  if (!isAdopted()) {
    await pull()
    if (!isAdopted() || remoteAhead) return
  }
  const _lastModified = getLocalLM()
  const body = JSON.stringify({
    tables: store.getTables(),
    values: store.getValues(),
    _lastModified,
    _schema: SCHEMA_SIZE,
  })
  try {
    const res = await fetch(`${base()}/state`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'X-Sync-Secret': getSetting('syncSecret'),
      },
      body,
      // keepalive lets the request survive the page being frozen, but caps the
      // body at 64KB — fall back to a normal fetch for bigger snapshots.
      keepalive: body.length < 60_000,
    })
    if (res.ok) {
      setLastPushed(_lastModified)
      markSyncOk()
    } else if (res.status === 409) {
      // Worker holds something newer (another device won the race) — take it.
      void pull()
    }
  } catch {
    /* offline — retried on next change, foreground, or background flush */
  }
}

export function pull(): Promise<boolean> {
  if (!configured()) return Promise.resolve(false)
  pulling ??= doPull().finally(() => {
    pulling = null
  })
  return pulling
}

async function doPull(): Promise<boolean> {
  try {
    const res = await fetch(`${base()}/state`, {
      headers: { 'X-Sync-Secret': getSetting('syncSecret') },
    })
    if (!res.ok) return false
    const remote = (await res.json()) as {
      tables?: Record<string, Record<string, unknown>>
      values?: Record<string, unknown>
      _lastModified?: number
      _schema?: number
    } | null

    if (!remote?.tables || !remote._lastModified) {
      // Server is empty: nothing to adopt — this device seeds it.
      if (!isAdopted()) markAdopted()
      markSyncOk()
      return false
    }

    if (typeof remote._schema === 'number' && remote._schema > SCHEMA_SIZE) {
      // Snapshot from a newer build — don't apply (we'd drop its new cells)
      // and don't push (we'd destroy them server-side) until we update.
      remoteAhead = true
      return false
    }

    const adopted = isAdopted()
    const localRows = countRows(store.getTables())
    const remoteRows = countRows(remote.tables)

    // Skip only what this device has already seen: compare against the last
    // state exchanged with the server, NOT the local-edit clock — a local
    // write during boot must not make us discard another device's changes.
    if (adopted && remote._lastModified <= getLastPushed()) {
      markSyncOk()
      return false
    }
    // An empty snapshot never replaces real data, whatever its timestamp says.
    if (remoteRows === 0 && localRows > 0) return false

    if (!adopted && remote._lastModified <= getLocalLM() && localRows >= remoteRows && localRows > 50) {
      // Not yet flagged as adopted, but this device clearly *is* the data
      // source (it holds at least as much data as the server, far beyond the
      // 5 migration-seeded rows, with newer edits) — e.g. the primary phone
      // right after an app update introduced the adoption flag. Keep local.
      markAdopted()
      setLastPushed(remote._lastModified)
      markSyncOk()
      return false
    }

    // Remote is about to replace local state. If local holds edits the server
    // never got (or this is a first adoption), keep a recoverable copy.
    if (localRows > 0 && (!adopted || hasUnpushed())) await snapshotNow()

    const versionBefore = Number(store.getValue('profile.milestonesVersion') ?? 0)
    applyingRemote = true
    try {
      store.transaction(() => {
        store.setTables(remote.tables as Parameters<typeof store.setTables>[0])
        if (remote.values) store.setValues(remote.values as Parameters<typeof store.setValues>[0])
        // A stale device's snapshot must never roll the migration version
        // back — the next boot would re-run destructive reset steps.
        const versionAfter = Number(store.getValue('profile.milestonesVersion') ?? 0)
        if (versionAfter < versionBefore) {
          store.setValue('profile.milestonesVersion', versionBefore)
        }
      })
    } finally {
      applyingRemote = false
    }
    setLocalLM(remote._lastModified)
    setLastPushed(remote._lastModified)
    markAdopted()
    markSyncOk()
    return true
  } catch {
    return false
  }
}

function onLocalChange(): void {
  if (applyingRemote) return
  setLocalLM(Date.now())
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void push(), PUSH_DEBOUNCE_MS)
}

/**
 * Idempotent. Safe to call when sync isn't configured (listeners stay dormant).
 * Resolves once the initial pull has settled, so boot-time writers (e.g. the
 * T212 auto-refresh) can wait and not race the incoming remote state.
 */
export function startSync(): Promise<boolean> {
  if (started) return Promise.resolve(false)
  started = true
  store.addTablesListener(onLocalChange)
  store.addValuesListener(onLocalChange)
  document.addEventListener('visibilitychange', () => {
    if (!configured()) return
    if (document.visibilityState === 'visible') {
      void pull().then(() => {
        // Changes stranded by a killed debounce timer get another chance.
        if (hasUnpushed()) void push()
      })
    } else {
      // Going to background: iOS freezes timers, so flush the pending push now.
      clearTimeout(pushTimer)
      if (hasUnpushed()) void push()
    }
  })
  // Live CRDT channel on top of the snapshot sync (cell-level merging).
  void import('@/lib/syncWs').then((m) => m.startWsSyncLifecycle())
  return pull()
}
