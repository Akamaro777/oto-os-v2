import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ScreenProps {
  title: string
  subtitle?: string
  /** Optional trailing element in the header (e.g. an action button). */
  action?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * Standard screen chrome: safe-area-aware sticky header + scrollable body.
 * Body reserves space for the fixed bottom nav.
 */
export function Screen({ title, subtitle, action, children, className }: ScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-md items-end justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-none tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      </header>
      <main className={cn('mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-4', className)}>
        {children}
      </main>
    </div>
  )
}

/** Simple centered empty-state used by not-yet-built screens. */
export function EmptyState({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
      {icon}
      <p className="max-w-[16rem] text-sm">{message}</p>
    </div>
  )
}
