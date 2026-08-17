/**
 * Home-screen icon badge. The icon used to carry the days-to-GMAT countdown,
 * but iOS renders any badge as the same red bubble as unread notifications —
 * "44 days left" reads as "44 unread". Nothing sets a badge now; this clears
 * whatever an older build left on the icon (a badge survives updates until it
 * is explicitly cleared) and tidies away the side-channel DB that fed it.
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
