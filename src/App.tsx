import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import type { TabId } from '@/lib/nav'
import { BottomNav } from '@/components/BottomNav'
import { Ambient } from '@/components/Ambient'
import { Toaster } from '@/components/ui/sonner'
import { maybeAutoSyncT212 } from '@/store/portfolio'
import { startSync } from '@/lib/sync'

// Code-split each screen so the initial load stays lean (recharts/motion only
// download when Track/Mentor are first opened).
const TodayScreen = lazy(() =>
  import('@/features/today/TodayScreen').then((m) => ({ default: m.TodayScreen })),
)
const PlanScreen = lazy(() =>
  import('@/features/plan/PlanScreen').then((m) => ({ default: m.PlanScreen })),
)
const ProjectsScreen = lazy(() =>
  import('@/features/projects/ProjectsScreen').then((m) => ({ default: m.ProjectsScreen })),
)
const PeopleScreen = lazy(() =>
  import('@/features/people/PeopleScreen').then((m) => ({ default: m.PeopleScreen })),
)
const TrackScreen = lazy(() =>
  import('@/features/track/TrackScreen').then((m) => ({ default: m.TrackScreen })),
)
const MentorScreen = lazy(() =>
  import('@/features/mentor/MentorScreen').then((m) => ({ default: m.MentorScreen })),
)

const SCREENS: Record<TabId, React.LazyExoticComponent<() => React.JSX.Element>> = {
  today: TodayScreen,
  plan: PlanScreen,
  projects: ProjectsScreen,
  people: PeopleScreen,
  track: TrackScreen,
  mentor: MentorScreen,
}

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const ActiveScreen = SCREENS[tab]

  useEffect(() => {
    // D4: silent portfolio refresh when the app opens
    maybeAutoSyncT212().then((total) => {
      if (total != null) toast.success(`Portfolio synced: €${Math.round(total).toLocaleString('en-US')}`)
    })
    // D1: cross-device sync (no-op until configured in Settings)
    startSync()
  }, [])

  return (
    <div className="min-h-dvh text-foreground">
      <Ambient />
      <Suspense fallback={<ScreenFallback />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <ActiveScreen />
          </motion.div>
        </AnimatePresence>
      </Suspense>
      <BottomNav active={tab} onChange={setTab} />
      <Toaster position="top-center" />
    </div>
  )
}

function ScreenFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="size-2.5 animate-pulse rounded-full bg-primary" />
    </div>
  )
}
