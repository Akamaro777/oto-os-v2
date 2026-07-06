import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TrackerCardProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** Consistent frosted-glass surface used across the app. */
export function TrackerCard({ title, action, children, className }: TrackerCardProps) {
  return (
    <section className={cn('glass edge-light rounded-2xl p-4', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && (
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
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
