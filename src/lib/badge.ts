/**
 * Home-screen icon badge — kept empty on purpose. The icon used to carry the
 * days-to-GMAT countdown, but iOS renders any badge as the same red bubble as
 * unread notifications, so "44 days left" read as "44 unread". Nothing may set
 * a badge; this clears whatever is on the icon (a badge survives app updates
 * until explicitly cleared) and tidies away the side-channel DB that fed it.
 *
 * Note: the count iOS itself adds for undismissed notifications is not this
 * badge and no API can clear it — that one is Settings → Notifications →
 * oto.os → Badges.
 */
export function clearIconBadge(): void {
  const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
  nav.clearAppBadge?.().catch(() => {})
  try {
    indexedDB.deleteDatabase('oto-sw-meta')
  } catch {
    /* nothing to clean up */
  }
}
