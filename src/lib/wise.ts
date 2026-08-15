/** Wise (ex-TransferWise) balance + spending via Oto's Cloudflare Worker proxy
 * (see workers/wise-proxy). The proxy holds the API token and does the PSD2
 * SCA signing; the app only ever talks to the proxy. */
import { getSetting } from '@/store/settings'
import { store } from '@/store/store'
import { todayISO } from './dates'
import { setWalletBalance, setWalletSpent } from '@/store/wallet'

export class WiseError extends Error {}

async function proxyGet(path: string): Promise<Record<string, unknown>> {
  const url = getSetting('wiseProxyUrl')
  const secret = getSetting('wiseProxySecret')
  if (!url || !secret) throw new WiseError('Configure the Wise proxy in Settings first.')
  let resp: Response
  try {
    resp = await fetch(url.replace(/\/$/, '') + path, {
      headers: { 'X-Proxy-Secret': secret },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    throw new WiseError(
      e instanceof DOMException && e.name === 'TimeoutError'
        ? 'Wise proxy timed out — try again'
        : e instanceof Error
          ? e.message
          : 'Network error',
    )
  }
  const body = (await resp.json().catch(() => {
    throw new WiseError('Wise proxy returned a non-JSON response.')
  })) as Record<string, unknown>
  if (!resp.ok) throw new WiseError(String(body.error ?? `HTTP ${resp.status}`))
  return body
}

export interface WiseSyncResult {
  balance: number
  /** Today's statement spend; null when the proxy has no statement key set up. */
  spentToday: number | null
}

/**
 * Pull the current EUR balance (always) and this month's per-day spend
 * (best effort — statement access needs the optional SCA key on the proxy).
 */
export async function syncWise(): Promise<WiseSyncResult> {
  const data = await proxyGet('/summary')
  const balance = Number(data.balance)
  if (!Number.isFinite(balance)) throw new WiseError('No balance in proxy response.')
  const today = todayISO()
  setWalletBalance(today, balance)

  let spentToday: number | null = null
  try {
    const start = `${today.slice(0, 7)}-01`
    const spend = await proxyGet(`/spend?start=${start}&end=${today}`)
    const byDay = spend.byDay as Record<string, unknown> | undefined
    if (byDay && typeof byDay === 'object') {
      store.transaction(() => {
        for (const [date, v] of Object.entries(byDay)) {
          const n = Number(v)
          if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(n)) setWalletSpent(date, n)
        }
      })
      spentToday = Number(byDay[today] ?? 0) || 0
    }
  } catch {
    // Statement endpoint is optional — balance-only tracking still works.
  }
  return { balance, spentToday }
}

/** True once the proxy URL + secret are configured. */
export function wiseConfigured(): boolean {
  return Boolean(getSetting('wiseProxyUrl') && getSetting('wiseProxySecret'))
}
