/**
 * oto.os sync + push Worker.
 *
 * Endpoints (all require header `X-Sync-Secret: <SYNC_SECRET>`):
 *   GET  /state             → latest state snapshot (or null)
 *   PUT  /state             → store state snapshot (last-write-wins)
 *   GET  /push/vapid        → { publicKey } for Web Push subscription
 *   POST /push/subscribe    → { subscription } register a device
 *   POST /push/unsubscribe  → { endpoint } remove a device
 *
 * Cron (see wrangler.toml) sends payload-less pushes; the app's service
 * worker turns them into the morning-briefing / evening check-in notification.
 *
 * Bindings: KV namespace `OTO`; secrets SYNC_SECRET, VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_JWK; var VAPID_SUBJECT (mailto:you@example.com).
 */

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Sync-Secret',
})

const json = (data, status, origin) =>
  new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json', ...cors(origin) },
  })

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*'
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })

    if (request.headers.get('X-Sync-Secret') !== env.SYNC_SECRET) {
      return json({ error: 'unauthorized' }, 401, origin)
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/$/, '')

    if (path === '/state' && request.method === 'GET') {
      const state = await env.OTO.get('state')
      return new Response(state ?? 'null', {
        headers: { 'content-type': 'application/json', ...cors(origin) },
      })
    }

    if (path === '/state' && request.method === 'PUT') {
      const body = await request.text()
      if (body.length > 20_000_000) return json({ error: 'too large' }, 413, origin)
      await env.OTO.put('state', body)
      return json({ ok: true }, 200, origin)
    }

    if (path === '/push/vapid' && request.method === 'GET') {
      return json({ publicKey: env.VAPID_PUBLIC_KEY ?? '' }, 200, origin)
    }

    if (path === '/push/subscribe' && request.method === 'POST') {
      const { subscription } = await request.json()
      if (!subscription?.endpoint) return json({ error: 'bad subscription' }, 400, origin)
      const key = 'sub:' + btoa(subscription.endpoint).slice(0, 200)
      await env.OTO.put(key, JSON.stringify(subscription))
      return json({ ok: true }, 200, origin)
    }

    if (path === '/push/unsubscribe' && request.method === 'POST') {
      const { endpoint } = await request.json()
      if (endpoint) await env.OTO.delete('sub:' + btoa(endpoint).slice(0, 200))
      return json({ ok: true }, 200, origin)
    }

    return json({ error: 'not found' }, 404, origin)
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendToAll(env))
  },
}

async function sendToAll(env) {
  const list = await env.OTO.list({ prefix: 'sub:' })
  for (const { name } of list.keys) {
    const raw = await env.OTO.get(name)
    if (!raw) continue
    const sub = JSON.parse(raw)
    try {
      const status = await sendPush(sub.endpoint, env)
      if (status === 404 || status === 410) await env.OTO.delete(name) // expired device
    } catch {
      /* keep going for other devices */
    }
  }
}

/* ── Payload-less Web Push with VAPID (ES256, WebCrypto) ── */

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

async function sendPush(endpoint, env) {
  const { origin } = new URL(endpoint)
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK)
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        aud: origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT || 'mailto:ozolins.oto@gmail.com',
      }),
    ),
  )
  const unsigned = `${header}.${claims}`
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${b64url(sig)}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      Urgency: 'normal',
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    },
  })
  return res.status
}
