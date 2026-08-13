import { useEffect, useState, type ReactNode } from 'react'
import { Provider } from 'tinybase/ui-react'
import { store, initPersistence } from './store'

/**
 * Provides the TinyBase store to the tree and blocks first paint until the
 * persisted IndexedDB snapshot has loaded, so the UI never flashes empty state
 * over real data.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    initPersistence().then(
      () => {
        if (alive) setReady(true)
      },
      (err: unknown) => {
        if (alive) setFailed(err instanceof Error ? err.message : String(err))
      },
    )
    return () => {
      alive = false
    }
  }, [])

  return (
    <Provider store={store}>
      {failed != null ? <BootFailed message={failed} /> : ready ? children : <BootSplash />}
    </Provider>
  )
}

function BootSplash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <span className="size-3 animate-pulse rounded-full bg-primary" />
    </div>
  )
}

/** Storage failed to open/load. Data is untouched — nothing was saved over it. */
function BootFailed({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-8 text-center text-foreground">
      <p className="font-serif text-2xl">Couldn't load your data</p>
      <p className="text-sm text-muted-foreground">
        The on-device database didn't open (private browsing or low storage can cause this).
        Nothing was overwritten. Error: <span className="font-mono text-xs">{message}</span>
      </p>
      <button
        type="button"
        className="rounded-lg bg-secondary px-4 py-2 text-sm"
        onClick={() => window.location.reload()}
      >
        Try again
      </button>
    </div>
  )
}
