# wise-proxy — Wise balance & spending for the app

A tiny Cloudflare Worker that lets the app read your Wise account safely.
The app's **Spending money** card calls it to show what's left of the monthly
€1,700 and how much you spent each day.

Two levels of setup:

| Level | What you get | What it needs |
|---|---|---|
| **1 · Balance only** (5 min) | € left, daily allowance, spend derived from balance drops | API token |
| **2 · Full statements** (+10 min) | exact per-day spend from real transactions | + an RSA key uploaded to Wise |

Level 1 is enough to start — the app automatically upgrades when level 2 works.

## Level 1 — balance only

1. **Create a Wise API token**
   - wise.com → profile menu → **Settings** → **API tokens** → *Add new token*.
   - Name it `oto-os`, set permissions to **Read only**. Copy the token.

2. **Deploy the Worker** (from this folder):
   ```sh
   cd workers/wise-proxy
   npx wrangler deploy
   npx wrangler secret put WISE_TOKEN     # paste the Wise token
   npx wrangler secret put PROXY_SECRET   # invent a long random string
   ```
   Note the printed URL, e.g. `https://wise-proxy.<you>.workers.dev`.

3. **Connect the app**: Settings → *Wise proxy URL* = that URL, *Wise proxy
   secret* = the PROXY_SECRET you invented. Save, then tap **Sync Wise** on the
   Money tab.

## Level 2 — per-day spending from statements

Wise puts statements behind PSD2 strong-customer-authentication: the Worker
must sign a one-time challenge with a private key whose public half you upload
to Wise once.

1. **Generate a key pair** (on your Mac):
   ```sh
   openssl genrsa -out wise-private.pem 2048
   openssl rsa -pubout -in wise-private.pem -out wise-public.pem
   # the Worker needs PKCS#8 format:
   openssl pkcs8 -topk8 -nocrypt -in wise-private.pem -out wise-private-pkcs8.pem
   ```

2. **Upload the public key**: wise.com → Settings → **API tokens** →
   *Manage public keys* → add `wise-public.pem`.

3. **Give the Worker the private key**:
   ```sh
   npx wrangler secret put WISE_PRIVATE_KEY_PEM < wise-private-pkcs8.pem
   ```
   Then delete `wise-private.pem` / `wise-private-pkcs8.pem` from the Mac
   (the Worker secret is now the only copy), and never commit them.

That's it — the next **Sync Wise** fills exact per-day spending.

## Endpoints (all need `X-Proxy-Secret`)

- `GET /summary` → `{ "balance": 1240.55, "currency": "EUR" }`
- `GET /spend?start=2026-08-01&end=2026-08-15` → `{ "byDay": { "2026-08-14": 23.90 } }`
  (DEBITs only, summed per day; needs level 2, otherwise returns 501)

## Notes

- The token and keys never leave Cloudflare; the app only knows the proxy URL
  + PROXY_SECRET pair, which can't be replayed against Wise directly.
- `ALLOWED_ORIGIN` in `wrangler.toml` locks browser CORS to the deployed app.
- If Wise ever returns `Wise 403` even at level 2, re-check that the uploaded
  public key matches the private key and that the token belongs to the same
  account.
