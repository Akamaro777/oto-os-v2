/**
 * oto.os sync + push Worker.
 *
 * Endpoints (all except /ws/* require header `X-Sync-Secret: <SYNC_SECRET>`):
 *   GET  /state             → latest state snapshot (or null)
 *   PUT  /state             → store state snapshot (last-write-wins + guards)
 *   GET  /ws-token          → { token } short-lived HMAC token for the WS path
 *   GET  /ws/<room>?t=…     → WebSocket upgrade to the TinyBase CRDT
 *                             synchronizer Durable Object (token auth)
 *   GET  /push/vapid        → { publicKey } for Web Push subscription
 *   POST /push/subscribe    → { subscription } register a device
 *   POST /push/unsubscribe  → { endpoint } remove a device
 *
 * Cron (see wrangler.toml) sends payload-less pushes; the app's service
 * worker turns them into the morning-briefing / evening check-in notification.
 *
 * Bindings: KV namespace `OTO`; Durable Object `OtoSyncDO`; secrets
 * SYNC_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_JWK; var VAPID_SUBJECT.
 */
import {
  WsServerDurableObject,
  getWsServerDurableObjectFetch,
} from 'tinybase/synchronizers/synchronizer-ws-server-durable-object'
import { createDurableObjectStoragePersister } from 'tinybase/persisters/persister-durable-object-storage'
import { createMergeableStore } from 'tinybase'

/** CRDT relay + server-side copy, so an offline device catches up on merge. */
export class OtoSyncDO extends WsServerDurableObject {
  createPersister() {
    return createDurableObjectStoragePersister(createMergeableStore(), this.ctx.storage)
  }
}

const wsFetch = getWsServerDurableObjectFetch('OTO_DO')

/* ── Short-lived WS auth tokens (the secret must never ride a URL) ── */

const TOKEN_TTL_MS = 60_000

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function makeWsToken(env) {
  const exp = Date.now() + TOKEN_TTL_MS
  return `${exp}.${await hmacHex(env.SYNC_SECRET, String(exp))}`
}

async function validWsToken(token, env) {
  const [expStr, sig] = String(token ?? '').split('.')
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false
  return (await hmacHex(env.SYNC_SECRET, expStr)) === sig
}

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

/** The deployed app origin, plus localhost so `npm run dev` can sync too. */
function pickOrigin(request, env) {
  const reqOrigin = request.headers.get('Origin') ?? ''
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin)) return reqOrigin
  return env.ALLOWED_ORIGIN || '*'
}

export default {
  async fetch(request, env) {
    const origin = pickOrigin(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/$/, '')

    // WebSocket path: browsers can't set headers on upgrades, so auth rides
    // a short-lived token minted by /ws-token below.
    if (path.startsWith('/ws/')) {
      if (!(await validWsToken(url.searchParams.get('t'), env))) {
        return json({ error: 'unauthorized' }, 401, origin)
      }
      return wsFetch(request, env)
    }

    if (request.headers.get('X-Sync-Secret') !== env.SYNC_SECRET) {
      return json({ error: 'unauthorized' }, 401, origin)
    }

    if (path === '/ws-token' && request.method === 'GET') {
      return json({ token: await makeWsToken(env) }, 200, origin)
    }

    if (path === '/state' && request.method === 'GET') {
      const state = await env.OTO.get('state')
      return new Response(state ?? 'null', {
        headers: { 'content-type': 'application/json', ...cors(origin) },
      })
    }

    if (path === '/state' && request.method === 'PUT') {
      const body = await request.text()
      if (body.length > 20_000_000) return json({ error: 'too large' }, 413, origin)

      // Validate before storing — a malformed body must never become "state".
      let incoming
      try {
        incoming = JSON.parse(body)
      } catch {
        return json({ error: 'invalid json' }, 400, origin)
      }
      if (typeof incoming?._lastModified !== 'number' || typeof incoming?.tables !== 'object') {
        return json({ error: 'missing tables/_lastModified' }, 400, origin)
      }

      // Reject stale snapshots (a zombie device pushing over newer data) and
      // empty snapshots trying to replace real data. `?force=1` overrides for
      // an intentional reset. The timestamp lives in its own small key so PUTs
      // don't have to parse the full stored state.
      const force = url.searchParams.get('force') === '1'
      if (!force) {
        let storedLM = Number((await env.OTO.get('state-lm')) ?? 0)
        if (!storedLM) {
          // Bootstrap: state written before the guard existed has no LM key —
          // read it out of the stored snapshot so the first guarded PUT can't
          // clobber real data with an old timestamp.
          try {
            const existing = await env.OTO.get('state')
            if (existing) storedLM = Number(JSON.parse(existing)?._lastModified ?? 0)
          } catch {
            storedLM = 0
          }
        }
        if (incoming._lastModified < storedLM) {
          return json({ error: 'stale', storedLastModified: storedLM }, 409, origin)
        }
        const rows = Object.values(incoming.tables).reduce(
          (n, t) => n + Object.keys(t ?? {}).length,
          0,
        )
        if (rows === 0 && storedLM > 0) {
          return json({ error: 'refusing empty state over existing data' }, 409, origin)
        }
      }

      await env.OTO.put('state', body)
      await env.OTO.put('state-lm', String(incoming._lastModified))
      return json({ ok: true }, 200, origin)
    }

    if (path === '/push/vapid' && request.method === 'GET') {
      return json({ publicKey: env.VAPID_PUBLIC_KEY ?? '' }, 200, origin)
    }

    if (path === '/push/subscribe' && request.method === 'POST') {
      const { subscription } = await request.json().catch(() => ({}))
      if (!subscription?.endpoint) return json({ error: 'bad subscription' }, 400, origin)
      const key = 'sub:' + btoa(subscription.endpoint).slice(0, 200)
      await env.OTO.put(key, JSON.stringify(subscription))
      return json({ ok: true }, 200, origin)
    }

    if (path === '/push/unsubscribe' && request.method === 'POST') {
      const { endpoint } = await request.json().catch(() => ({}))
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
