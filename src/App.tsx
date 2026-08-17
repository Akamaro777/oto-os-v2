import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import type { TabId } from '@/lib/nav'
import { BottomNav } from '@/components/BottomNav'
import { Ambient } from '@/components/Ambient'
import { Toaster } from '@/components/ui/sonner'
import { maybeAutoSyncT212 } from '@/store/portfolio'
import { startSync } from '@/lib/sync'
import { clearIconBadge } from '@/lib/badge'

// Code-split each screen so the initial load stays lean (recharts/motion only
// download when Track/Mentor are first opened).
const TodayScreen = lazy(() =>
  import('@/features/today/TodayScreen').then((m) => ({ default: m.TodayScreen })),
)
const PlanScreen = lazy(() =>
  import('@/features/plan/PlanScreen').then((m) => ({ default: m.PlanScreen })),
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
  people: PeopleScreen,
  track: TrackScreen,
  mentor: MentorScreen,
}

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const ActiveScreen = SCREENS[tab]

  useEffect(() => {
    // D1: cross-device sync (no-op until configured in Settings). The T212
    // refresh must wait for the initial pull — writing portfolio rows first
    // would race the incoming remote state.
    startSync().finally(() => {
      // D4: silent portfolio refresh when the app opens
      maybeAutoSyncT212().then((total) => {
        if (total != null) toast.success(`Portfolio synced: €${Math.round(total).toLocaleString('en-US')}`)
      })
    })
    // Drop the icon badge an older build left behind (it read as unread mail).
    clearIconBadge()
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
            <ErrorBoundary key={tab}>
              <ActiveScreen />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </Suspense>
      <BottomNav active={tab} onChange={setTab} />
      <Toaster position="top-center" />
    </div>
  )
}

/**
 * One bad persisted row must never take the whole app down — a crash in a
 * screen is contained here, and the other tabs keep working (keyed by tab so
 * switching away and back retries the render).
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="font-serif text-2xl">This screen hit an error</p>
          <p className="text-sm text-muted-foreground">
            Your data is safe — the other tabs still work. Error:{' '}
            <span className="font-mono text-xs">{this.state.error.message}</span>
          </p>
          <button
            type="button"
            className="rounded-lg bg-secondary px-4 py-2 text-sm"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function ScreenFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="size-2.5 animate-pulse rounded-full bg-primary" />
    </div>
  )
}
