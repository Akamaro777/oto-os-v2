import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TrackerCardProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** Consistent titled surface used across the trackers. */
export function TrackerCard({ title, action, children, className }: TrackerCardProps) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-4', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && (
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
