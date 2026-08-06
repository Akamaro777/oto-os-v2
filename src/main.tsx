import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from '@/store/StoreProvider'

// iOS restores the installed PWA from memory without a page load, so the
// default load-time update check can miss new versions for days. Check again
// every time the app comes to the foreground (and every 15 min while open);
// when a new SW takes control, reload so the page runs matching assets.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => registration.update().catch(() => {})
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, 15 * 60 * 1000)
  },
})
let hadController = Boolean(navigator.serviceWorker?.controller)
let reloading = false
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!hadController) {
    // First-ever install taking control — not an update, don't reload.
    hadController = true
    return
  }
  if (reloading) return
  reloading = true
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
