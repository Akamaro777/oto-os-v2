/**
 * The GMAT plan (Aug 11 → Sep 30 2026), one entry per day.
 *
 * Built around pure sessions: a day is either ALL exercises (~80 timed
 * questions on ONE subject) or ALL review (redo misses, technique videos,
 * mistake sheet). Oto sustains ~80 questions in a 3h block when nothing
 * interrupts it; mixing modes inside one session meant review never happened.
 *
 * Subject split across the 30 exercise days: 18 quant / 6 Data Insights /
 * 6 verbal — 60/20/20, weighted to quant early since he started from zero
 * there (23rd percentile) while verbal only needs its RC gap closed.
 *
 * Static by design: the plan is fixed, so it needs no storage and survives a
 * data reset. Progress (done ticks) lives in the store.
 */

export type PlanKind = 'learn' | 'drill' | 'sections' | 'mock' | 'review' | 'taper' | 'rest' | 'exam'
export type PlanSubject = 'quant' | 'verbal' | 'di'

export interface PlanDay {
  date: string // YYYY-MM-DD
  kind: PlanKind
  /** Which section the session is on; absent on review/mock/rest days. */
  subject?: PlanSubject
  /** One-line headline shown on the Today card. */
  title: string
  /** The concrete work, one item per line. */
  items: string[]
}

export const KIND_META: Record<PlanKind, { label: string; color: string }> = {
  learn: { label: 'Learn', color: '#7dd3fc' },
  drill: { label: 'Exercise', color: '#c9f158' },
  sections: { label: 'Sections', color: '#4ade80' },
  mock: { label: 'Mock', color: '#fbbf24' },
  review: { label: 'Review', color: '#f0abfc' },
  taper: { label: 'Taper', color: '#8b8d95' },
  rest: { label: 'Rest', color: '#8b8d95' },
  exam: { label: 'Exam', color: '#f36a5a' },
}

export const SUBJECT_META: Record<PlanSubject, { label: string; color: string }> = {
  quant: { label: 'Quant', color: '#7dd3fc' },
  verbal: { label: 'Verbal', color: '#f0abfc' },
  di: { label: 'Data Insights', color: '#4ade80' },
}

const d = (date: string, kind: PlanKind, title: string, ...items: string[]): PlanDay => ({
  date,
  kind,
  title,
  items,
})

/** An exercise day: 4 blocks of 20 timed questions, answers marked but not analysed. */
const ex = (date: string, subject: PlanSubject, source: string, ...extra: string[]): PlanDay => ({
  date,
  kind: 'drill',
  subject,
  title: `80 timed — ${SUBJECT_META[subject].label.toLowerCase()}`,
  items: ['4 × 20 questions, 40 min per block', source, ...extra, 'Mark right/wrong only — no analysis today'],
})

/** A review day: no new questions. */
const rev = (date: string, title: string, ...items: string[]): PlanDay =>
  d(date, 'review', title, ...items)

export const GMAT_PLAN: PlanDay[] = [
  // ── Block 1 · Quant foundations ──
  { date: '2026-08-11', kind: 'drill', subject: 'quant', title: '82 timed — quant', items: ['Done — OG Quant Review, number properties onward'] },
  ex('2026-08-12', 'quant', 'OG Quant Review — continue where you stopped'),
  rev('2026-08-13', 'Review: Aug 11–12', 'Redo every miss cold, no notes', 'Videos on your 3 worst topics', 'Start your mistake sheet'),
  ex('2026-08-14', 'quant', 'Finish the OG Quant book (~45 left), then TTP'),
  ex('2026-08-15', 'quant', 'TTP — arithmetic & number properties'),
  rev('2026-08-16', 'Review: Aug 14–15', 'Redo every miss cold', 'Videos on your 3 worst topics', 'Update the mistake sheet'),

  ex('2026-08-17', 'quant', 'TTP — equations & inequalities'),
  ex('2026-08-18', 'verbal', 'Redo all 133 logged verbal errors', 'Cold and timed — if you can’t beat them, nothing changed'),
  rev('2026-08-19', 'Review: Aug 17–18', 'Redo every miss cold', 'Videos on your 3 worst topics', 'Update the mistake sheet'),
  ex('2026-08-20', 'quant', 'TTP — exponents, roots, inequalities'),
  ex('2026-08-21', 'quant', 'TTP — weakest topics so far'),
  ex('2026-08-22', 'verbal', 'RC-heavy: inference + detail questions', '70% RC / 30% CR'),
  rev('2026-08-23', 'Review: Aug 20–22', 'Redo every miss cold', 'Videos on your 3 worst topics', 'Update the mistake sheet'),

  // ── Block 2 · Data Insights + Mock 1 ──
  ex('2026-08-24', 'di', 'OG DI Review — Data Sufficiency first', 'DS is your 22nd-percentile hole'),
  ex('2026-08-25', 'di', 'OG DI Review — finish the book'),
  rev('2026-08-26', 'Review: Aug 24–25', 'Redo every DS miss cold', 'Videos on the DS decision framework', 'Update the mistake sheet'),
  ex('2026-08-27', 'quant', 'TTP — rates, ratios, percents'),
  ex('2026-08-28', 'quant', 'TTP — word problems'),
  d('2026-08-29', 'mock', 'Mock 1', 'Full official practice exam, morning start', 'Exam conditions, no pausing'),
  rev('2026-08-30', 'Review Mock 1', 'Every wrong answer + every unsure right one', 'Videos on the patterns it exposed', 'Update the mistake sheet'),

  // ── Block 3 · Depth ──
  ex('2026-08-31', 'quant', 'TTP — statistics, sets, counting, probability'),
  ex('2026-09-01', 'quant', 'TTP — weakest topics from the app'),
  rev('2026-09-02', 'Review: Aug 31 – Sep 1', 'Redo every miss cold', 'Videos on your 3 worst topics', 'Update the mistake sheet'),
  ex('2026-09-03', 'verbal', 'RC inference + detail, timed', '70% RC / 30% CR'),
  ex('2026-09-04', 'di', 'DS heavy + graphs and tables'),
  ex('2026-09-05', 'quant', 'Hardest tier you can handle'),
  rev('2026-09-06', 'Review: Sep 3–5', 'Redo every miss cold', 'Videos on your 3 worst topics', 'Update the mistake sheet'),

  // ── Block 4 · Integration + Mock 2 ──
  ex('2026-09-07', 'quant', 'Weak spots from the app'),
  ex('2026-09-08', 'quant', 'Mixed, strict 2:00 per question'),
  rev('2026-09-09', 'Review: Sep 7–8', 'Redo every miss cold', 'Videos on your 3 worst topics', 'Update the mistake sheet'),
  ex('2026-09-10', 'verbal', 'Full RC passages under time'),
  ex('2026-09-11', 'di', 'DS, multi-source, two-part'),
  d('2026-09-12', 'mock', 'Mock 2', 'Full official practice exam', 'Exam conditions'),
  rev('2026-09-13', 'Review Mock 2', 'Every wrong answer + every unsure right one', 'Compare against Mock 1 — what moved?', 'Update the mistake sheet'),

  // ── Block 5 · Weak-spot targeting + Mock 3 ──
  ex('2026-09-14', 'quant', 'Your #1 weak spot from the app'),
  ex('2026-09-15', 'quant', 'Your #2 weak spot from the app'),
  rev('2026-09-16', 'Review: Sep 14–15', 'Redo every miss cold', 'Videos on your 3 worst topics', 'Update the mistake sheet'),
  ex('2026-09-17', 'di', 'DS + whatever Mock 2 exposed'),
  ex('2026-09-18', 'verbal', 'RC + CR mix at exam pacing'),
  d('2026-09-19', 'mock', 'Mock 3', 'Full official practice exam', 'Exam conditions'),
  rev('2026-09-20', 'Review Mock 3', 'Every wrong answer + every unsure right one', 'Pacing audit: where did the clock go?', 'Update the mistake sheet'),

  // ── Block 6 · Sharpening + Mock 4 ──
  ex('2026-09-21', 'quant', 'Whatever is still weak'),
  ex('2026-09-22', 'verbal', 'Final RC push, strict timing'),
  rev('2026-09-23', 'Review: Sep 21–22', 'Redo every miss cold', 'Videos on anything still shaky', 'Update the mistake sheet'),
  ex('2026-09-24', 'quant', 'Hardest tier, strict 2:00 pacing'),
  ex('2026-09-25', 'di', 'Full-speed Data Sufficiency'),
  d('2026-09-26', 'mock', 'Mock 4', 'Final predictor — treat it like the real thing'),
  rev('2026-09-27', 'Review Mock 4', 'Last full error pass', 'Read the mistake sheet end to end'),

  // ── Final days ──
  d('2026-09-28', 'taper', 'Taper', '20 easy timed questions to stay warm', 'Read your mistake sheet once', '90 min max, then stop'),
  d('2026-09-29', 'rest', 'Rest', 'No studying', 'Check test centre logistics + ID', 'Sleep early'),
  d('2026-09-30', 'exam', 'EXAM DAY', 'Target 705', 'Past 3 min: guess and move on', 'Use all 3 bookmark edits per section'),
]

const BY_DATE = new Map(GMAT_PLAN.map((p) => [p.date, p]))

export function planFor(date: string): PlanDay | undefined {
  return BY_DATE.get(date)
}

/** Position in the plan, for the "day 4 of 51" label. */
export function planIndex(date: string): { day: number; total: number } | null {
  const i = GMAT_PLAN.findIndex((p) => p.date === date)
  if (i === -1) return null
  return { day: i + 1, total: GMAT_PLAN.length }
}

export const PLAN_START = GMAT_PLAN[0].date
export const PLAN_END = GMAT_PLAN[GMAT_PLAN.length - 1].date
