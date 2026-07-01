# oto.os — v2 (personal operating system)

A from-scratch rebuild of Oto's personal-OS app with a proper stack. This file is auto-loaded each session. Read **SPEC.md** for full requirements and **SETUP.md** for scaffolding.

## What this is
A mobile-first PWA that is Oto's **main phone app**: daily planning + life/goal tracking + projects + people, with an AI mentor. It replaces v1 (a single ~4,600-line `index.html`), which is kept as a behavior reference at `../oto-os-v1-commandcenter-2026-07-01.html`.

## Locked stack — do NOT add libraries speculatively
- **Vite + React + TypeScript (strict)** — foundation/build
- **Tailwind CSS v4** — styling
- **shadcn/ui** (Radix + Tailwind, Lucide icons) — components
- **TinyBase** — local-first reactive data store + sync engine (the single source of truth; persist to IndexedDB)
- **vite-plugin-pwa** — offline + installable

Add **only when a feature needs it**: `date-fns` (dates), `recharts` (charts).
**Defer until the core is solid**: `dnd-kit` (drag-drop), `motion` (animation).
Rule: **one library per job, no overlaps. Never add a dependency "to be safe."**

## Architecture
```
src/
  main.tsx, App.tsx        # shell + bottom tab nav
  store/                   # TinyBase store, schema, typed accessors, persistence, sync
  features/<name>/         # one folder per feature (today, plan, projects, people, track, mentor)
  components/ui/           # shadcn components
  components/              # shared app components
  lib/                     # helpers (dates, ids, formatting)
```
Keep components small and typed. Business logic lives in `store/` + `lib/`, not in JSX.

## How to work (this is how we keep quality high)
1. Scaffold skeleton + data layer first (SETUP.md). Get an empty app shell running.
2. Build **one** feature end-to-end (start with **Tasks** — simplest), verify, lock the pattern.
3. Replicate for the rest, verifying each. **Do not scaffold all features at once.**
4. PWA + polish (dnd-kit, animation) **last**.
Verify every step: `tsc` typecheck, `npm run build`, and run the app.

## Data & sync
- TinyBase is the single source of truth; the UI reacts to it. Persist locally to IndexedDB.
- Keep a sync path (TinyBase synchronizer) to mirror v1's cross-device behavior.
- **Migration:** import Oto's v1 export JSON (see SPEC.md → Migration). v1 field names are mirrored to make this easy. Do **not** commit that file — it contains secrets.

## Secrets
API keys (Anthropic, sync, Trading 212 proxy) live at runtime / in local settings, **never committed**. The v1 export contains live keys — treat as sensitive; Oto is rotating them.

## Deploy
Static build (`npm run build`) → GitHub Pages (see SETUP.md). Set Vite `base` for the repo.

## Don'ts
No single-file monolith. No global mutable state outside the store. No untyped `any`. No speculative dependencies. No committing secrets. Don't build all features before the first one is verified.
