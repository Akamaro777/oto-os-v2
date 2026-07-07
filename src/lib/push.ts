/**
 * Web Push subscription management. The VAPID public key and subscription
 * storage live on the same sync Worker (settings.syncUrl + syncSecret).
 */
import { getSetting } from '@/store/settings'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function base(): string {
  return getSetting('syncUrl').replace(/\/$/, '')
}

function headers(): Record<string, string> {
  return { 'content-type': 'application/json', 'X-Sync-Secret': getSetting('syncSecret') }
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) != null
}

/** Request permission, subscribe with the Worker's VAPID key, register the subscription. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Notifications need the installed app (iOS 16.4+).')
  if (!getSetting('syncUrl') || !getSetting('syncSecret'))
    throw new Error('Configure the Sync URL + secret first.')

  const vapidRes = await fetch(`${base()}/push/vapid`, { headers: headers() })
  if (!vapidRes.ok) throw new Error('Could not reach the sync worker.')
  const { publicKey } = (await vapidRes.json()) as { publicKey?: string }
  if (!publicKey) throw new Error('Worker has no VAPID key configured.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission denied.')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
  })
  const res = await fetch(`${base()}/push/subscribe`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ subscription: sub.toJSON() }),
  })
  if (!res.ok) {
    await sub.unsubscribe()
    throw new Error('Worker rejected the subscription.')
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await fetch(`${base()}/push/unsubscribe`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  await sub.unsubscribe()
}
