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

  useEffect(() => {
    let alive = true
    initPersistence().then(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <Provider store={store}>
      {ready ? children : <BootSplash />}
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
