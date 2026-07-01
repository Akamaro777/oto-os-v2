# oto.os v2 — Setup / scaffold

**Prereqs:** Node 20+ and npm. Run everything from inside this `oto-os-v2/` folder.

> Docs to follow if a command changed: shadcn Vite guide → https://ui.shadcn.com/docs/installation/vite · Tailwind v4 Vite → https://tailwindcss.com/docs/installation/vite · vite-plugin-pwa → https://vite-pwa-org.netlify.app/

## 1. Scaffold Vite + React + TypeScript
```bash
npm create vite@latest . -- --template react-ts
npm install
```

## 2. Tailwind CSS v4 (Vite plugin)
```bash
npm install tailwindcss @tailwindcss/vite
```
- `vite.config.ts`: add `tailwindcss()` to `plugins`.
- `src/index.css`: replace contents with `@import "tailwindcss";`

## 3. Path alias `@/*` (needed by shadcn)
- `tsconfig.json` + `tsconfig.app.json`: add `"baseUrl": ".", "paths": { "@/*": ["./src/*"] }`.
- `vite.config.ts`: `resolve: { alias: { '@': '/src' } }` (or use `path.resolve`).

## 4. shadcn/ui
```bash
npx shadcn@latest init
# add components as features need them, e.g.:
npx shadcn@latest add button card dialog input select tabs badge sheet dropdown-menu calendar sonner switch textarea
```
(`lucide-react` is pulled in as the icon set.)

## 5. Data store + PWA
```bash
npm install tinybase
npm install -D vite-plugin-pwa
```
- `vite.config.ts`: add `VitePWA({ registerType: 'autoUpdate', manifest: { name: 'oto.os', short_name: 'OS', theme_color: '#0c0d10', background_color: '#0c0d10', display: 'standalone', icons: [...] } })`.

## 6. Add per-feature only when needed
```bash
npm install date-fns      # when building the planner
npm install recharts      # when building tracker charts
```

## 7. Run / build
```bash
npm run dev
npm run build && npm run preview
```

## 8. Deploy to GitHub Pages
- `vite.config.ts`: set `base: '/<repo-name>/'` for a project page (or `'/'` for a user/custom-domain page).
- **Option A — gh-pages package**
  ```bash
  npm install -D gh-pages
  # package.json → "scripts": { "deploy": "npm run build && gh-pages -d dist" }
  npm run deploy
  ```
- **Option B — GitHub Actions** (preferred): build on push to `main`, publish `dist/` to Pages. Add a `deploy.yml` workflow.

## Build order (per CLAUDE.md)
1. App shell + bottom nav (Today · Plan · Projects · People · Track · Mentor) — empty screens.
2. TinyBase store + schema + IndexedDB persistence (SPEC.md data model).
3. **Tasks** feature end-to-end → verify → lock the pattern.
4. Planner → Projects → People → Trackers → Today → Mentor (verify each).
5. v1 data importer.
6. PWA, then deferred polish (dnd-kit, motion).

## References (parent folder)
- `../oto-os-v1-commandcenter-2026-07-01.html` — v1 app; open it for exact feature/behavior/field details.
- Oto's v1 export JSON — place it locally for the importer; **keep it out of git** (contains secrets).
