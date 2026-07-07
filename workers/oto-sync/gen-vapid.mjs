/**
 * Generate VAPID keys for Web Push. Run once:  node gen-vapid.mjs
 * Paste the outputs into `wrangler secret put VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_JWK`.
 */
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
const publicKey = Buffer.from(raw).toString('base64url')
const privateJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey))

console.log('VAPID_PUBLIC_KEY:\n' + publicKey + '\n')
console.log('VAPID_PRIVATE_JWK:\n' + privateJwk)
