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
