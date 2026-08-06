import { store } from './store'
import { T, type Priority } from './schema'

/**
 * Versioned one-time data migrations, run on boot after persistence loads.
 * Guarded by profile.milestonesVersion (synced across devices); task seeds use
 * fixed row ids so a race between two devices stays idempotent.
 */
const MILESTONES_VERSION = 2

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
    // New objectives: GMAT 705 · €5k/mo by December · 12 countries · 30 bodies
    store.setValue('profile.gmatTargetScore', 705)
    store.setValue('profile.gmatScoreTarget', 705)
    store.setValue('profile.gmatTargetDate', '2026-12-31')
    store.setValue('profile.mrr', 0)
    store.setValue('profile.mrrTarget', 5000)
    store.setValue('profile.mrrTargetDate', '2026-12-31')
    store.setValue('profile.mrrStartDate', '2026-08-06')
    store.setValue('profile.countriesVisited', 0)
    store.setValue('profile.countriesTarget', 12)
    store.setValue('profile.countriesTargetDate', '2026-12-31')
    store.setValue('profile.countriesStartDate', '2026-08-06')
    store.setValue('profile.bodiesCount', 0)
    store.setValue('profile.bodiesTarget', 30)
    store.setValue('profile.bodiesTargetDate', '2026-12-31')
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

    store.setValue('profile.milestonesVersion', MILESTONES_VERSION)
  })
}
