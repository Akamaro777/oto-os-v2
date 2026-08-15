/**
 * oto.os Wise proxy Worker.
 *
 * The PWA can't call api.wise.com directly (no CORS, and the API token must
 * never live in the browser), so this Worker holds the token and relays two
 * read-only views (all endpoints require header `X-Proxy-Secret`):
 *
 *   GET /summary                     → { balance, currency }   EUR balance
 *   GET /spend?start=&end=           → { byDay: { "YYYY-MM-DD": eurSpent } }
 *
 * /spend reads the balance statement, which is behind PSD2 Strong Customer
 * Authentication: Wise replies 403 with an `x-2fa-approval` one-time token,
 * we sign that token with the RSA private key (SHA-256, PKCS#1 v1.5, base64)
 * and retry with the signature in `X-Signature`. The key pair is created once
 * and its public half uploaded to Wise (see README). Without the key secret,
 * /summary still works — the app degrades to balance-only tracking.
 *
 * Secrets: WISE_TOKEN, PROXY_SECRET, WISE_PRIVATE_KEY_PEM (optional).
 * Vars: ALLOWED_ORIGIN.
 */

const API = 'https://api.wise.com'

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'X-Proxy-Secret',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }
}

function json(env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  })
}

async function wiseGet(env, path, extraHeaders = {}) {
  return fetch(API + path, {
    headers: { Authorization: `Bearer ${env.WISE_TOKEN}`, ...extraHeaders },
  })
}

/** Sign an SCA one-time token: RSA PKCS#1 v1.5 over SHA-256, base64 output. */
async function signOtt(env, ott) {
  const pem = env.WISE_PRIVATE_KEY_PEM || ''
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')
  if (!body) return null
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(ott))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

/** GET with automatic SCA retry when Wise asks for stronger authentication. */
async function wiseGetSca(env, path) {
  let resp = await wiseGet(env, path)
  const ott = resp.headers.get('x-2fa-approval')
  if (resp.status === 403 && ott) {
    const signature = await signOtt(env, ott)
    if (!signature) {
      return { error: 'Statement access needs the SCA key — see workers/wise-proxy/README.md', status: 501 }
    }
    resp = await wiseGet(env, path, { 'x-2fa-approval': ott, 'X-Signature': signature })
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    return { error: `Wise ${resp.status}: ${text.slice(0, 200)}`, status: 502 }
  }
  return { data: await resp.json() }
}

/** The personal profile id, and the EUR balance on it. */
async function findEurBalance(env) {
  const profilesResp = await wiseGet(env, '/v1/profiles')
  if (!profilesResp.ok) return { error: `Wise profiles ${profilesResp.status}`, status: 502 }
  const profiles = await profilesResp.json()
  const profile = profiles.find((p) => p.type === 'personal') ?? profiles[0]
  if (!profile) return { error: 'No Wise profile on this token', status: 502 }

  const balResp = await wiseGet(env, `/v4/profiles/${profile.id}/balances?types=STANDARD`)
  if (!balResp.ok) return { error: `Wise balances ${balResp.status}`, status: 502 }
  const balances = await balResp.json()
  const eur = balances.find((b) => b.currency === 'EUR') ?? balances[0]
  if (!eur) return { error: 'No balance found', status: 502 }
  return { profileId: profile.id, balanceId: eur.id, currency: eur.currency, amount: eur.amount?.value ?? 0 }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env) })
    const url = new URL(request.url)

    if (request.headers.get('X-Proxy-Secret') !== env.PROXY_SECRET) {
      return json(env, { error: 'Unauthorized' }, 401)
    }

    if (url.pathname === '/summary') {
      const r = await findEurBalance(env)
      if (r.error) return json(env, { error: r.error }, r.status)
      return json(env, { balance: r.amount, currency: r.currency })
    }

    if (url.pathname === '/spend') {
      const start = url.searchParams.get('start') || ''
      const end = url.searchParams.get('end') || ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return json(env, { error: 'start and end must be YYYY-MM-DD' }, 400)
      }
      const acct = await findEurBalance(env)
      if (acct.error) return json(env, { error: acct.error }, acct.status)

      const path =
        `/v1/profiles/${acct.profileId}/balance-statements/${acct.balanceId}/statement.json` +
        `?currency=${acct.currency}&intervalStart=${start}T00:00:00.000Z&intervalEnd=${end}T23:59:59.999Z&type=COMPACT`
      const r = await wiseGetSca(env, path)
      if (r.error) return json(env, { error: r.error }, r.status)

      // Sum outgoing money per calendar day; card refunds (CREDITs from
      // merchants) are ignored rather than netted — simpler and safer.
      const byDay = {}
      for (const tx of r.data.transactions ?? []) {
        if (tx.type !== 'DEBIT') continue
        const day = String(tx.date ?? '').slice(0, 10)
        if (!day) continue
        const value = Math.abs(Number(tx.amount?.value ?? 0))
        if (!Number.isFinite(value)) continue
        byDay[day] = Math.round(((byDay[day] ?? 0) + value) * 100) / 100
      }
      return json(env, { byDay })
    }

    return json(env, { error: 'Not found' }, 404)
  },
}
