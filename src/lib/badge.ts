/**
 * GMAT countdown on the home-screen icon (App Badging API — iOS 16.4+ for
 * installed PWAs, plus desktop Chrome), and a tiny IndexedDB side-channel so
 * the service worker's push notifications can carry the same countdown (the
 * SW can't read the main store once it lives in localStorage).
 */
import { getProfileString } from '@/store/profile'
import { todayISO, daysBetween } from './dates'

const META_DB = 'oto-sw-meta'

export function updateGmatBadge(): void {
  const targetDate = getProfileString('gmatTargetDate')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return
  const daysLeft = daysBetween(todayISO(), targetDate)

  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (daysLeft > 0 && daysLeft <= 99) {
    nav.setAppBadge?.(daysLeft).catch(() => {})
  } else {
    nav.clearAppBadge?.().catch(() => {})
  }

  writeSwMeta({ gmatTargetDate: targetDate }).catch(() => {})
}

function writeSwMeta(meta: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(META_DB, 1)
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains('kv')) open.result.createObjectStore('kv')
    }
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('kv', 'readwrite')
      tx.objectStore('kv').put(meta, 'meta')
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
    }
  })
}
