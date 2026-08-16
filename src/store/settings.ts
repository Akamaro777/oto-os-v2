import { useValue } from 'tinybase/ui-react'
import { store } from './store'

export type SettingKey =
  | 'theme'
  | 'apiKey'
  | 'jbKey'
  | 'jbBinId'
  | 't212ProxyUrl'
  | 't212ProxySecret'
  | 'wiseProxyUrl'
  | 'wiseProxySecret'
  | 'syncUrl'
  | 'syncSecret'
  | 'modelSonnet'
  | 'modelHaiku'

export function getSetting(key: SettingKey): string {
  return String(store.getValue(`settings.${key}`) ?? '')
}

export function setSetting(key: SettingKey, value: string): void {
  store.setValue(`settings.${key}`, value)
}

/** Reactive read of a settings.* string value. */
export function useSetting(key: SettingKey): string {
  return (useValue(`settings.${key}`, store) as string | undefined) ?? ''
}

/* ── Event reminders ──
 * Its own accessors rather than a SettingKey: this value is a number, and the
 * helpers above stringify. The Worker's reminder cron reads the same synced
 * value, so the bounds here must match leadMinutes() in workers/oto-sync. */

export const NTFY_LEAD_DEFAULT = 60
export const NTFY_LEAD_MIN = 1
export const NTFY_LEAD_MAX = 1440

export function getNtfyLeadMin(): number {
  const n = Number(store.getValue('settings.ntfyLeadMin'))
  return Number.isFinite(n) && n >= NTFY_LEAD_MIN && n <= NTFY_LEAD_MAX
    ? Math.round(n)
    : NTFY_LEAD_DEFAULT
}

export function setNtfyLeadMin(mins: number): void {
  const n = Math.round(mins)
  if (!Number.isFinite(n)) return
  store.setValue('settings.ntfyLeadMin', Math.min(NTFY_LEAD_MAX, Math.max(NTFY_LEAD_MIN, n)))
}
