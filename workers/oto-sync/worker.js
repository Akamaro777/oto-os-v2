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
 * Cron (see wrangler.toml):
 *   every 5 min    event reminders — the ONLY notification this Worker sends.
 *                  Reads the state snapshot, finds calendar events starting
 *                  within the lead window, and pushes each one with an
 *                  encrypted payload carrying its title and time. Oto asked
 *                  for nothing else: no briefings, no check-ins, no nudges.
 *
 * Bindings: KV namespace `OTO`; Durable Object `OtoSyncDO`; secrets
 * SYNC_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_JWK; vars VAPID_SUBJECT,
 * DEFAULT_TZ.
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

    // Run the reminder sweep on demand and report what it decided. Same code
    // path as the cron, so "did my reminder work?" is answerable without
    // waiting for a tick.
    if (path === '/reminders/run' && request.method === 'GET') {
      return json(await sendEventReminders(env, url.searchParams.get('dry') === '1'), 200, origin)
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
    // Heartbeat: proves the schedule is alive without needing a device.
    ctx.waitUntil(env.OTO.put('cron-last', new Date().toISOString()))
    // Reminders are idempotent (one KV `sent:` key per event), so a tick that
    // overlaps another costs nothing.
    ctx.waitUntil(sendEventReminders(env))
  },
}

/* ── Event reminders ── */

const DEFAULT_LEAD_MIN = 60
const SENT_TTL_S = 7 * 24 * 3600

/**
 * Milliseconds that `tz` is ahead of UTC at instant `ts`. Derived by
 * formatting the instant in that zone and reading the wall clock back, which
 * is the only way to get a real IANA offset (DST included) without a library.
 */
function tzOffsetMs(ts, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value]),
  )
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return wall - ts
}

/** "2026-08-17" + "08:00" as wall time in `tz` → UTC epoch ms. */
function zonedToUtcMs(date, time, tz) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  // Two passes: the first offset is read at the wrong instant near a DST
  // jump, the second lands on the right side of it.
  let ts = wall - tzOffsetMs(wall, tz)
  ts = wall - tzOffsetMs(ts, tz)
  return ts
}

function leadMinutes(values) {
  // ntfyLeadMin is the pre-Web-Push name; read it so an early save still counts.
  const n = Number(values['settings.reminderLeadMin'] ?? values['settings.ntfyLeadMin'])
  return Number.isFinite(n) && n >= 1 && n <= 1440 ? Math.round(n) : DEFAULT_LEAD_MIN
}

/** Returns a summary so /reminders/run can report what it decided. */
async function sendEventReminders(env, dry = false) {
  const out = {
    ok: true, tz: null, leadMin: null, scanned: 0,
    due: [], sent: [], failed: [], skipped: null,
    devices: (await env.OTO.list({ prefix: 'sub:' })).keys.length,
    cronLast: await env.OTO.get('cron-last'),
  }
  const raw = await env.OTO.get('state')
  if (!raw) return { ...out, ok: false, skipped: 'no state in KV' }
  let state
  try {
    state = JSON.parse(raw)
  } catch {
    return { ...out, ok: false, skipped: 'state is not valid JSON' }
  }
  const events = state?.tables?.events
  if (!events || typeof events !== 'object') {
    return { ...out, ok: false, skipped: 'no events table' }
  }

  const values = state.values ?? {}
  // The phone writes its own IANA zone on every boot, so reminders follow him
  // when he travels instead of firing on a hard-coded home offset.
  const tz = typeof values['profile.timezone'] === 'string' && values['profile.timezone']
    ? values['profile.timezone']
    : env.DEFAULT_TZ || 'Europe/Riga'
  const leadMin = leadMinutes(values)
  const lead = leadMin * 60_000
  const now = Date.now()
  out.tz = tz
  out.leadMin = leadMin

  for (const [id, ev] of Object.entries(events)) {
    out.scanned++
    const date = String(ev?.date ?? '')
    const time = String(ev?.time ?? '')
    // All-day entries carry no time — there is no hour to count back from.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) continue

    let startMs
    try {
      startMs = zonedToUtcMs(date, time, tz)
    } catch {
      continue
    }
    if (!Number.isFinite(startMs)) continue

    // Fire once the window opens and the event hasn't started. Stated this way
    // a skipped tick still sends (late but useful) rather than being missed.
    if (now < startMs - lead || now >= startMs) continue
    out.due.push({ id, title: String(ev.title ?? ''), startsInMin: Math.round((startMs - now) / 60_000) })

    // Keyed on the time too, so moving an event re-arms its reminder.
    const key = `sent:${id}:${date}T${time}`
    if (await env.OTO.get(key)) continue
    if (dry) continue
    const r = await pushToDevices(env, reminderPayload(ev, startMs, now))
    if (r.delivered > 0) {
      await env.OTO.put(key, '1', { expirationTtl: SENT_TTL_S })
      out.sent.push(id)
    } else {
      // No stamp on failure, so the next tick retries.
      out.failed.push({ id, ...r })
    }
  }
  return out
}

/** The reminder notification for one event, as the service worker renders it. */
function reminderPayload(ev, startMs, now) {
  const mins = Math.max(1, Math.round((startMs - now) / 60_000))
  const parts = [`in ${mins} min · ${String(ev.time)}`]
  if (ev.category) parts.push(String(ev.category))
  if (ev.notes) parts.push(String(ev.notes).slice(0, 200))
  return {
    kind: 'event',
    title: String(ev.title || 'Event').slice(0, 120),
    body: parts.join(' · '),
    // Per-event tag: two reminders must stack, not replace each other.
    tag: `oto-os-event-${String(ev.date)}-${String(ev.time)}`,
  }
}

/**
 * Deliver to every registered device. Returns how many accepted it; drops
 * subscriptions the push service reports as gone.
 */
async function pushToDevices(env, payload) {
  const list = await env.OTO.list({ prefix: 'sub:' })
  let delivered = 0
  let devices = 0
  let lastStatus = null
  for (const { name } of list.keys) {
    const raw = await env.OTO.get(name)
    if (!raw) continue
    let sub
    try {
      sub = JSON.parse(raw)
    } catch {
      continue
    }
    devices++
    try {
      const status = await sendPush(sub, env, payload)
      lastStatus = status
      if (status === 404 || status === 410) await env.OTO.delete(name) // expired device
      else if (status >= 200 && status < 300) delivered++
    } catch {
      /* keep going for other devices */
    }
  }
  return { devices, delivered, lastStatus }
}

/* ── Web Push with VAPID (ES256) and an aes128gcm payload (RFC 8291) ── */

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

function b64urlDecode(s) {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function concatBytes(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8),
  )
}

/**
 * RFC 8291 message encryption. The push service only relays ciphertext — it
 * can't read the event title, and neither can Cloudflare; only the subscribed
 * device holds the private half.
 */
async function encryptPayload(plaintext, p256dh, auth) {
  const enc = new TextEncoder()
  const uaPublic = b64urlDecode(p256dh) // device public key, uncompressed P-256 point
  const authSecret = b64urlDecode(auth)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey))
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256),
  )

  const prk = await hkdf(
    authSecret,
    shared,
    concatBytes(enc.encode('WebPush: info\0'), uaPublic, asPublic),
    32,
  )
  const cek = await hkdf(salt, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, prk, enc.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 is the padding delimiter marking this as the final record.
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      concatBytes(enc.encode(plaintext), new Uint8Array([2])),
    ),
  )

  // Header: salt(16) | record size(4) | key id length(1) | key id (our public key)
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return concatBytes(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext)
}

async function sendPush(sub, env, payload) {
  // Every push carries an encrypted reminder. A subscription without keys
  // could only produce a blank notification, so don't send it one.
  if (!sub?.keys?.p256dh || !sub?.keys?.auth) return 0
  const endpoint = sub.endpoint
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

  const headers = {
    TTL: '86400',
    Urgency: 'normal',
    Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
  }
  const body = await encryptPayload(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth)
  headers['Content-Encoding'] = 'aes128gcm'
  headers['Content-Type'] = 'application/octet-stream'

  const res = await fetch(endpoint, { method: 'POST', headers, body })
  return res.status
}
