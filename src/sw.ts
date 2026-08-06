/// <reference lib="webworker" />
/**
 * Custom service worker: precaching (via vite-plugin-pwa injectManifest)
 * plus Web Push. Pushes are payload-less (sent by the sync Worker's cron);
 * the notification text is chosen here from the local time of day.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Activate a new version immediately instead of waiting for every window to
// close — iOS keeps the installed PWA alive for days, which left updates stuck
// in the "waiting" state. The page reloads itself on controllerchange.
self.addEventListener('install', () => {
  void self.skipWaiting()
})
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function notificationForNow(payload?: string): { title: string; body: string } {
  if (payload) return { title: 'oto.os', body: payload }
  const h = new Date().getHours()
  if (h < 12)
    return { title: 'Plan your day', body: 'Open oto.os — set your Top 3 and your first block.' }
  if (h >= 17)
    return { title: 'Close your rings', body: '30-second check-in: log the day, rate it, set tomorrow’s #1.' }
  return { title: 'oto.os', body: 'Quick check-in — how is the day tracking?' }
}

self.addEventListener('push', (event) => {
  let payload: string | undefined
  try {
    payload = event.data?.text() || undefined
  } catch {
    payload = undefined
  }
  const { title, body } = notificationForNow(payload)
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: 'pwa-192.png',
      badge: 'pwa-192.png',
      tag: 'oto-os-checkin',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients[0]
      if (existing) return existing.focus()
      return self.clients.openWindow(self.registration.scope)
    }),
  )
})
