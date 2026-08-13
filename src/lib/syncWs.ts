/**
 * Real-time CRDT sync: a TinyBase WebSocket synchronizer against the sync
 * Worker's Durable Object. Concurrent edits on two devices merge at CELL
 * level — nobody's snapshot overwrites anybody. The REST snapshot sync
 * (lib/sync.ts) keeps running alongside as the offline/fallback path and as
 * the state source for push-to-app.mjs.
 *
 * Auth: the client trades the sync secret (header) for a short-lived HMAC
 * token, which rides the WebSocket URL — the long-lived secret never appears
 * in a URL.
 */
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client'
import type { WsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client'
import { store } from '@/store/store'
import { getSetting } from '@/store/settings'

let synchronizer: WsSynchronizer<WebSocket> | null = null
let connecting = false

function configured(): boolean {
  return getSetting('syncUrl').length > 0 && getSetting('syncSecret').length > 0
}

function base(): string {
  return getSetting('syncUrl').replace(/\/$/, '')
}

async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await fetch(`${base()}/ws-token`, {
      headers: { 'X-Sync-Secret': getSetting('syncSecret') },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const { token } = (await res.json()) as { token?: string }
    return token ?? null
  } catch {
    return null
  }
}

/** Connect (or reconnect) the live synchronizer. Safe to call repeatedly. */
export async function connectWsSync(): Promise<void> {
  if (!configured() || connecting) return
  if (synchronizer && synchronizer.getWebSocket().readyState === WebSocket.OPEN) return
  connecting = true
  try {
    // Drop a dead synchronizer before building a fresh one.
    if (synchronizer) {
      await synchronizer.destroy().catch(() => {})
      synchronizer = null
    }
    const token = await fetchWsToken()
    if (!token) return // worker not updated yet, or offline — REST sync covers us

    const wsUrl = `${base().replace(/^http/, 'ws')}/ws/oto?t=${encodeURIComponent(token)}`
    const ws = new WebSocket(wsUrl)
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('ws failed'))
      setTimeout(() => reject(new Error('ws timeout')), 10_000)
    })
    synchronizer = await createWsSynchronizer(store, ws)
    await synchronizer.startSync()
  } catch {
    // Silent — the REST snapshot path keeps devices in sync without it.
  } finally {
    connecting = false
  }
}

/** True while the live CRDT channel is up (shown nowhere yet; handy for debug). */
export function wsSyncActive(): boolean {
  return synchronizer?.getWebSocket().readyState === WebSocket.OPEN
}

/** Wire foreground reconnects. Called once from startSync(). */
export function startWsSyncLifecycle(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void connectWsSync()
  })
  void connectWsSync()
}
