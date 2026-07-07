/**
 * Cross-device sync (v1-style, last-write-wins snapshots).
 * The app mirrors the whole store to a tiny Cloudflare Worker (see workers/)
 * guarded by a shared secret: push (debounced) on local change, pull on open
 * and whenever the app returns to the foreground.
 */
import { store } from '@/store/store'
import { getSetting } from '@/store/settings'

const LM_KEY = 'oto-sync-lastModified'
const PUSH_DEBOUNCE_MS = 4000

let started = false
let applyingRemote = false
let pushTimer: ReturnType<typeof setTimeout> | undefined

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

async function push(): Promise<void> {
  if (!configured()) return
  const _lastModified = getLocalLM()
  try {
    await fetch(`${base()}/state`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'X-Sync-Secret': getSetting('syncSecret'),
      },
      body: JSON.stringify({ tables: store.getTables(), values: store.getValues(), _lastModified }),
    })
  } catch {
    /* offline — next change or foreground pull retries */
  }
}

export async function pull(): Promise<boolean> {
  if (!configured()) return false
  try {
    const res = await fetch(`${base()}/state`, {
      headers: { 'X-Sync-Secret': getSetting('syncSecret') },
    })
    if (!res.ok) return false
    const remote = (await res.json()) as {
      tables?: Record<string, unknown>
      values?: Record<string, unknown>
      _lastModified?: number
    } | null
    if (!remote?.tables || !remote._lastModified) return false
    if (remote._lastModified <= getLocalLM()) return false

    applyingRemote = true
    try {
      store.transaction(() => {
        store.setTables(remote.tables as Parameters<typeof store.setTables>[0])
        if (remote.values) store.setValues(remote.values as Parameters<typeof store.setValues>[0])
      })
    } finally {
      applyingRemote = false
    }
    setLocalLM(remote._lastModified)
    return true
  } catch {
    return false
  }
}

function onLocalChange(): void {
  if (applyingRemote) return
  setLocalLM(Date.now())
  clearTimeout(pushTimer)
  pushTimer = setTimeout(push, PUSH_DEBOUNCE_MS)
}

/** Idempotent. Safe to call when sync isn't configured (listeners stay dormant). */
export function startSync(): void {
  if (started) return
  started = true
  store.addTablesListener(onLocalChange)
  store.addValuesListener(onLocalChange)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pull()
  })
  if (configured()) pull()
}
