# oto-sync Worker — cross-device sync + push notifications

One tiny Cloudflare Worker that (a) mirrors your app data across devices and
(b) sends the morning-briefing / evening check-in notifications.

## Deploy (~5 minutes, from this folder)

```bash
cd workers/oto-sync

# 1. Log in to your Cloudflare account (same one as the T212 proxy)
npx wrangler login

# 2. Create the storage namespace, then paste the printed id into wrangler.toml
npx wrangler kv namespace create OTO

# 3. Generate push keys, then set the three secrets
node gen-vapid.mjs
npx wrangler secret put SYNC_SECRET        # invent a long random password
npx wrangler secret put VAPID_PUBLIC_KEY   # from gen-vapid output
npx wrangler secret put VAPID_PRIVATE_JWK  # from gen-vapid output

# 4. Ship it
npx wrangler deploy
```

Wrangler prints your Worker URL, e.g. `https://oto-sync.ozolins-oto.workers.dev`.

## Connect the app (each device, once)

Settings (⚙️) → **Sync URL** = the Worker URL · **Sync secret** = your SYNC_SECRET → Save.
Then tap **Enable notifications** (must be the installed home-screen app; iOS 16.4+).

- Data now syncs automatically: pushed a few seconds after any change, pulled
  whenever the app opens or returns to the foreground. Last write wins.
- Notifications arrive at **07:00** and **21:30** CEST (edit `crons` in
  wrangler.toml to change; times are UTC there).
