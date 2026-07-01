# oto.os v2 — Specification

## User & goals
**Oto** — Tilburg IBA honors student, PwC Latvia intern, prepping for the GMAT, targeting **HEC MFin** (6-school application strategy); builds side businesses (often with Claude Code) and wants to eventually leave finance for his own business. This app is his **main phone app**.

Four life pillars + a planning/productivity layer:
- **Body** — fitness, weight (bulk then cut), sleep, training
- **Social** — network, dating, day rating
- **Money/Business** — portfolio net worth, business hours, ideas
- **Study/CV** — GMAT prep, mock exams, applications

## Design direction
- Dark-first, minimal, **premium**. Accent lime `#c9f158` on near-black `#0c0d10`.
- Pillar colors: body `#fb923c` (orange), social `#f0abfc` (pink), money `#4ade80` (green), study/cv `#7dd3fc` (blue), personal = muted grey.
- Type: a serif for display (Instrument Serif-style), a mono for labels/numbers (JetBrains Mono-style), clean sans for body.
- Mobile-first, **bottom tab nav**, card-based, generous spacing, subtle motion, safe-area aware.
- Nav: **Today · Plan · Projects · People · Track · Mentor**. "Track" is a hub containing Body / Social / Money / Biz / Study sub-tabs.
- Reference the v1 look for the vibe, but modernize and improve it — cleaner hierarchy, better spacing, real components.

## Features (all exist in v1 — open `../oto-os-v1-commandcenter-2026-07-01.html` for exact behaviors)
1. **Today (home)** — command center: greeting + live briefing; **Now / Next** block; today's **timeline** (planner blocks + calendar events, checkable); **Top 3**; **tasks due/overdue**; **people to reach**; daily targets; **North Star goals** with % done + pace target + how far ahead/behind in real units.
2. **Plan** — **hourly time-blocking planner** per day (window configurable, default 07:00–24:00); blocks have start/end/pillar/done + optional linked task; calendar events overlay the grid; **Top 3**; **"Plan tomorrow"**; month **calendar** + upcoming list; **Tasks** list with filters (Open/Today/Overdue/Done); **Inbox**.
3. **Projects** — dashboard: name, status (idea/active/paused/done), next action, link (repo/doc), notes, pillar; shows linked open-task count; archive. *Later:* drag Kanban via dnd-kit.
4. **People (CRM)** — contacts: name, how-met, notes, `lastContact`, `cadenceDays` → **reconnect-due**, `birthday` → **soon** badge; "Log touch" sets lastContact=today; sorted by recency; reconnect + birthday nudges also surface on Today.
5. **Quick capture** — global **＋** (text or voice) → inbox; triage each item into a task / project / event.
6. **Track hub** — the 5 trackers:
   - **Body**: weight (**all-time** trend), sleep (**all-time** trend), meals via **AI macro logger**, **weekly training grid** (5 sessions: push / pull / legs / shoulders / stretch+abs; resets every Monday; each marked with the date done), **all-time training totals** chart.
   - **Social**: 1–10 day rating + note; 7-day trend.
   - **Money**: portfolio net worth (manual entry **+ Trading 212 sync** via Oto's Cloudflare Worker proxy); entry history; trend chart vs target.
   - **Business**: daily hours (target **4h/day**); cumulative goal (**144h** from 2026-06-30 → 2026-08-05); ideas bank; next-day plan.
   - **Study/CV**: GMAT study hours (target 4h/day); **mock exams** chart vs **700** target.
7. **Mentor** — AI chat (Anthropic API) with full user state in the system prompt; quick prompts. Also powers **AI event capture** (voice → calendar) and **AI meal macro logging**.
8. **North Star goals** — bulk weight, cut weight, €10k portfolio, 144h business, GMAT mock → 700. Each shows % complete, the on-pace target for today, and the gap ahead/behind in real units (kg / € / h / pts).

## Data model (TinyBase — mirror v1 field names for clean migration)
- `profile` (targets, goal dates, planner day window), `settings` (theme, Anthropic apiKey, sync keys, t212 proxy url/secret)
- `planner[date] = { blocks[], top3[] }`  ·  `tasks[]`  ·  `projects[]`  ·  `inbox[]`  ·  `contacts[]`
- `body[date]`, `meals[date][]`, `social[date]`, `money[date]`, `cv[date]`
- `portfolio[]`, `gymSessions[weekKey]`, `mockExams[]`, `events[]`, `ideas[]`
See v1 `DEFAULT_STATE` and the render functions for exact field shapes. Keep the same keys.

## Migration
Oto has a **v1 export JSON** (a localStorage snapshot: profile/body/meals/social/money/cv/portfolio/events/gymSessions/etc.). Build a **one-time importer** that maps it into the TinyBase store.
- Normalize legacy `gymSessions` (some weeks stored booleans `true/false`; convert to the current date-based format, drop falsy).
- Do **not** commit the export file — it contains live API keys.

## AI integrations (keep from v1)
- **Mentor chat:** `POST https://api.anthropic.com/v1/messages`, a Sonnet-class model, system prompt built from the user's current state, header `anthropic-dangerous-direct-browser-access: true`.
- **Meal logger + event capture:** a Haiku-class model, strict JSON extraction.
- Use the **latest Claude models** (4.x Opus/Sonnet/Haiku) — confirm current model IDs at build time.

## PWA
Installable + offline (vite-plugin-pwa / Workbox). App icon = **lime dot on dark** (regenerate crisp, or reuse v1's). `display: standalone`, `theme-color #0c0d10`, apple-touch-icon + manifest.
