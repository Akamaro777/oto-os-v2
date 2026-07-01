/** Trading 212 account summary via Oto's Cloudflare Worker proxy. */
export interface T212Summary {
  total: number
  free?: number
  invested?: number
  ppl?: number
}

export class T212Error extends Error {}

export async function fetchT212Summary(url: string, secret: string): Promise<T212Summary> {
  if (!url || !secret) throw new T212Error('Configure the T212 proxy in Settings first.')
  let resp: Response
  try {
    resp = await fetch(url.replace(/\/$/, '') + '/summary', {
      headers: { 'X-Proxy-Secret': secret },
    })
  } catch (e) {
    throw new T212Error(e instanceof Error ? e.message : 'Network error')
  }
  if (!resp.ok) {
    const body = (await resp.json().catch(() => ({}))) as { error?: string }
    throw new T212Error(body.error || `HTTP ${resp.status}`)
  }
  const data = (await resp.json()) as Record<string, unknown>
  const total = (data.total ?? data.totalValue) as number | undefined
  if (typeof total !== 'number') throw new T212Error('No total value in proxy response.')
  return {
    total,
    free: typeof data.free === 'number' ? data.free : undefined,
    invested: typeof data.invested === 'number' ? data.invested : undefined,
    ppl: typeof data.ppl === 'number' ? data.ppl : undefined,
  }
}
