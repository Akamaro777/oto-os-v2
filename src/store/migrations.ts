import { store } from './store'
import { T, type Priority } from './schema'

/**
 * Versioned one-time data migrations, run on boot after persistence loads.
 * Guarded by profile.milestonesVersion (synced across devices); task seeds use
 * fixed row ids so a race between two devices stays idempotent.
 *
 * Each step must only run for stores below its version, and later steps must
 * never reset manual counters (mrr, countriesVisited, bodiesCount).
 */
const MILESTONES_VERSION = 4

/** The day Oto restarts everything: same goals, clean slate. */
const RESET_START = '2026-08-11'

/** Kickoff tasks for the Aug–Dec 2026 milestone reset, in do-first order. */
const SEED_TASKS: Array<{ id: string; title: string; priority: Priority; category: string }> = [
  { id: 'seed-gmat-register', title: 'Register for the GMAT', priority: 'high', category: 'study' },
  { id: 'seed-ask-20-people', title: 'Ask 20 people the go-to things I should do', priority: 'high', category: 'social' },
  { id: 'seed-football-club', title: 'Join a football club', priority: 'med', category: 'social' },
  { id: 'seed-redo-dating', title: 'Redo Tinder + Instagram', priority: 'med', category: 'social' },
  { id: 'seed-china-flights', title: 'Book flights to China', priority: 'med', category: 'personal' },
]

export function runMigrations(): void {
  const v = Number(store.getValue('profile.milestonesVersion') ?? 0)
  if (v >= MILESTONES_VERSION) return

  store.transaction(() => {
    if (v < 2) {
      // v2 — new objectives: GMAT 705 · €5k/mo · 12 countries · 30 (initial counters)
      store.setValue('profile.gmatTargetScore', 705)
      store.setValue('profile.gmatScoreTarget', 705)
      store.setValue('profile.mrr', 0)
      store.setValue('profile.mrrTarget', 5000)
      store.setValue('profile.mrrStartDate', '2026-08-06')
      store.setValue('profile.countriesVisited', 0)
      store.setValue('profile.countriesTarget', 12)
      store.setValue('profile.countriesStartDate', '2026-08-06')
      store.setValue('profile.bodiesCount', 0)
      store.setValue('profile.bodiesTarget', 30)
      store.setValue('profile.bodiesStartDate', '2026-08-06')
      store.setValue('profile.callsDailyTarget', 70)

      SEED_TASKS.forEach((t, i) => {
        if (store.hasRow(T.tasks, t.id)) return
        store.setRow(T.tasks, t.id, {
          title: t.title,
          priority: t.priority,
          category: t.category,
          done: false,
          createdTs: Date.now() + i,
        })
      })
    }

    if (v < 3) {
      // v3 — deadlines: GMAT Sep 20, everything else Dec 1; trackers re-aimed
      // at the objectives (3h morning deep work, Aug 6→Dec 1 business window).
      store.setValue('profile.gmatTargetDate', '2026-09-20')
      store.setValue('profile.mrrTargetDate', '2026-12-01')
      store.setValue('profile.countriesTargetDate', '2026-12-01')
      store.setValue('profile.bodiesTargetDate', '2026-12-01')
      store.setValue('profile.studyTarget', 3)
      store.setValue('profile.bizCumulativeStart', '2026-08-06')
      store.setValue('profile.bizCumulativeDate', '2026-12-01')
      store.setValue('profile.bizCumulativeTarget', 468)
      store.setValue('profile.portfolioTargetDate', '2026-12-01')
    }

    if (v < 4) {
      // v4 — restart every objective from Aug 11, goals unchanged.
      store.setValue('profile.mrrStartDate', RESET_START)
      store.setValue('profile.countriesStartDate', RESET_START)
      store.setValue('profile.bodiesStartDate', RESET_START)
      store.setValue('profile.bizCumulativeStart', RESET_START)
      store.setValue('profile.bodiesCount', 0)
      store.setValue('profile.mrr', 0)
      store.setValue('profile.countriesVisited', 0)
      // GMAT moved to Sep 30; the rest still land Dec 1.
      store.setValue('profile.gmatTargetDate', '2026-09-30')
      store.setValue('profile.gmatScoreTargetDate', '2026-09-30')
      store.setValue('profile.mrrTargetDate', '2026-12-01')
      store.setValue('profile.countriesTargetDate', '2026-12-01')
      store.setValue('profile.bodiesTargetDate', '2026-12-01')
      store.setValue('profile.bizCumulativeDate', '2026-12-01')

      // Counters restart empty; the GMAT error log and score report are kept.
      store.delTable(T.countries)
      store.delTable(T.revenue)
      store.delTable(T.deals)
      // Progress logs from before the restart.
      store.delTable(T.rules)
      store.delTable(T.blocks)
      store.delTable(T.top3)
      // Projects were removed from the app.
      store.delTable('projects')
    }

    store.setValue('profile.milestonesVersion', MILESTONES_VERSION)
  })
}
