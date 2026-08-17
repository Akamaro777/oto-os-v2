/// <reference lib="webworker" />
/**
 * Custom service worker: precaching (via vite-plugin-pwa injectManifest)
 * plus Web Push. The only push the sync Worker sends is a calendar-event
 * reminder, which carries its own encrypted title/body; a push arriving
 * without one is a leftover and gets the quietest notification that still
 * satisfies the platform's "must show something" rule.
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

interface PushPayload {
  kind?: string
  title?: string
  body?: string
  tag?: string
}

/** Reminders arrive as JSON; anything else is a stray push we mostly ignore. */
function parsePayload(raw: string | undefined): PushPayload | undefined {
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'title' in parsed) return parsed as PushPayload
  } catch {
    /* not JSON */
  }
  return { body: raw }
}

self.addEventListener('push', (event) => {
  let payload: string | undefined
  try {
    payload = event.data?.text() || undefined
  } catch {
    payload = undefined
  }
  event.waitUntil(
    (async () => {
      const parsed = parsePayload(payload)
      // Only event reminders are sent, and they carry their own text. A push
      // without one can only be an old cron still in flight — show it silently
      // under a single reusable tag so such strays collapse into one line.
      const title = parsed?.title || 'oto.os'
      const body = parsed?.body ?? ''
      // Per-event tag so two reminders stack instead of replacing each other.
      const tag = parsed?.tag || 'oto-os-misc'
      await self.registration.showNotification(title, {
        body,
        icon: 'pwa-192.png',
        badge: 'pwa-192.png',
        tag,
      })
    })(),
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
