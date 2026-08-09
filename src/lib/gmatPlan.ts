/**
 * The 50-day GMAT plan (Aug 11 → Sep 30 2026), one entry per day.
 * Static by design: the plan is fixed, so it needs no storage and always
 * survives a data reset. Progress (done ticks) lives in the store.
 */

export type PlanKind = 'learn' | 'drill' | 'sections' | 'mock' | 'review' | 'taper' | 'rest' | 'exam'

export interface PlanDay {
  date: string // YYYY-MM-DD
  kind: PlanKind
  /** One-line headline shown on the Today card. */
  title: string
  /** The concrete work, one item per line. */
  items: string[]
}

export const KIND_META: Record<PlanKind, { label: string; color: string }> = {
  learn: { label: 'Learn', color: '#7dd3fc' },
  drill: { label: 'Drill', color: '#c9f158' },
  sections: { label: 'Sections', color: '#4ade80' },
  mock: { label: 'Mock', color: '#fbbf24' },
  review: { label: 'Review', color: '#f0abfc' },
  taper: { label: 'Taper', color: '#8b8d95' },
  rest: { label: 'Rest', color: '#8b8d95' },
  exam: { label: 'Exam', color: '#f36a5a' },
}

const d = (date: string, kind: PlanKind, title: string, ...items: string[]): PlanDay => ({
  date,
  kind,
  title,
  items,
})

export const GMAT_PLAN: PlanDay[] = [
  // ── Week 1 · Quant book, all 207 questions ──
  d('2026-08-11', 'learn', 'Number properties', '1h video: factors, primes, divisibility', '35 timed quant'),
  d('2026-08-12', 'drill', '50 timed quant', 'Number properties + fractions/percents'),
  d('2026-08-13', 'learn', 'Algebra basics', '1h video: algebra foundations', '35 timed quant'),
  d('2026-08-14', 'drill', '50 timed quant', 'Algebra'),
  d('2026-08-15', 'sections', '3 quant sections', '63 questions, 45 min each, exam conditions'),
  d('2026-08-16', 'review', 'Review week 1', 'Redo every miss from the week, timed', 'No new questions'),

  // ── Week 2 · TTP starts, algebra deep ──
  d('2026-08-17', 'learn', 'TTP: equations & inequalities', '1h lessons', '40 timed quant'),
  d('2026-08-18', 'drill', '50 timed quant', 'Equations & inequalities'),
  d('2026-08-19', 'drill', '50 timed quant', 'Mixed algebra'),
  d('2026-08-20', 'learn', 'TTP: exponents & roots', '1h lessons', '40 timed quant'),
  d('2026-08-21', 'drill', '50 timed quant', 'Exponents & roots'),
  d('2026-08-22', 'sections', '3 quant sections', '63 questions, 45 min each'),
  d('2026-08-23', 'review', 'Review week 2', 'Redo every miss, timed'),

  // ── Week 3 · DI book (170 q) + Mock 1 ──
  d('2026-08-24', 'learn', 'Data Sufficiency method', '1h video: the AD/BCE framework', '35 timed DS'),
  d('2026-08-25', 'drill', '50 timed DI', 'Data Sufficiency heavy'),
  d('2026-08-26', 'drill', '50 timed DI', 'Graphs, tables, multi-source'),
  d('2026-08-27', 'drill', '50 timed DI', 'Two-part + mixed — DI book finished'),
  d('2026-08-28', 'drill', '50 timed quant', 'Your weak spots from the app'),
  d('2026-08-29', 'mock', 'Mock 1', 'Full official practice exam, morning start'),
  d('2026-08-30', 'review', 'Review Mock 1', 'Every wrong answer + every unsure right one', "Plus the week's misses"),

  // ── Week 4 · Rates, word problems, stats ──
  d('2026-08-31', 'learn', 'TTP: rates, ratios, work & speed', '1h lessons', '40 timed quant'),
  d('2026-09-01', 'drill', '50 timed quant', 'Rates & ratios'),
  d('2026-09-02', 'drill', '50 timed quant', 'Word problems'),
  d('2026-09-03', 'learn', 'TTP: statistics, sets, counting, probability', '1h lessons', '40 timed quant'),
  d('2026-09-04', 'drill', '50 timed quant', 'Stats & counting'),
  d('2026-09-05', 'sections', '3 quant sections', '63 questions, 45 min each'),
  d('2026-09-06', 'review', 'Review week 4', 'Redo every miss, timed'),

  // ── Week 5 · Mixed, verbal returns + Mock 2 ──
  d('2026-09-07', 'drill', '50 timed quant', 'Top weak spot from the app'),
  d('2026-09-08', 'sections', 'Quant ×2 + DI ×1', '2 timed quant sections + 1 timed DI section'),
  d('2026-09-09', 'sections', 'Verbal ×2', '46 questions, RC-focused'),
  d('2026-09-10', 'drill', '50 timed quant', 'Weak spot'),
  d('2026-09-11', 'sections', 'DI ×2 + quant ×1', '2 timed DI sections + 1 timed quant section'),
  d('2026-09-12', 'mock', 'Mock 2', 'Full official practice exam'),
  d('2026-09-13', 'review', 'Review Mock 2', "Plus the week's misses"),

  // ── Week 6 · Weak spots + Mock 3 ──
  d('2026-09-14', 'drill', '55 timed quant', 'Top weak spot from the app'),
  d('2026-09-15', 'drill', '55 timed quant', 'Second weak spot'),
  d('2026-09-16', 'sections', 'Verbal ×2 + DI ×1', '2 timed verbal sections + 1 timed DI section'),
  d('2026-09-17', 'drill', '55 timed DI', 'Data Sufficiency heavy'),
  d('2026-09-18', 'sections', 'Quant ×2 + verbal ×1', '2 timed quant sections + 1 timed verbal section'),
  d('2026-09-19', 'mock', 'Mock 3', 'Full official practice exam'),
  d('2026-09-20', 'review', 'Review Mock 3', 'Plus misses'),

  // ── Week 7 · Sharpening + Mock 4 ──
  d('2026-09-21', 'drill', '55 timed quant', 'Weak spots'),
  d('2026-09-22', 'sections', 'DI ×2 + quant ×1', '2 timed DI sections + 1 timed quant section'),
  d('2026-09-23', 'sections', 'Verbal ×2 + quant ×1', '2 timed verbal sections + 1 timed quant section'),
  d('2026-09-24', 'sections', 'Quant ×2 + DI ×1', '2 timed quant sections + 1 timed DI section'),
  d('2026-09-25', 'sections', 'One of each', 'Quant + verbal + DI, one timed section each (64 q)'),
  d('2026-09-26', 'mock', 'Mock 4', 'Final predictor — treat it like the real thing'),
  d('2026-09-27', 'review', 'Review Mock 4', 'Last full error pass'),

  // ── Final days ──
  d('2026-09-28', 'taper', 'Taper', '20 timed easy questions', 'Read your whole error log', '90 min max, then stop'),
  d('2026-09-29', 'rest', 'Rest', 'No studying', 'Check test centre logistics + ID', 'Sleep early'),
  d('2026-09-30', 'exam', 'EXAM DAY', 'Target 705', 'Past 3 min: guess and move on', 'Use all 3 bookmark edits per section'),
]

const BY_DATE = new Map(GMAT_PLAN.map((p) => [p.date, p]))

export function planFor(date: string): PlanDay | undefined {
  return BY_DATE.get(date)
}

/** Position in the plan, for the "day 4 of 50" label. */
export function planIndex(date: string): { day: number; total: number } | null {
  const i = GMAT_PLAN.findIndex((p) => p.date === date)
  if (i === -1) return null
  return { day: i + 1, total: GMAT_PLAN.length }
}

export const PLAN_START = GMAT_PLAN[0].date
export const PLAN_END = GMAT_PLAN[GMAT_PLAN.length - 1].date
