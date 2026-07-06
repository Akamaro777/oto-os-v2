import type { ReactNode } from 'react'
import { motion } from 'motion/react'
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
 * Standard screen chrome: safe-area-aware sticky glass header + scrollable body.
 * Body reserves space for the floating bottom nav.
 */
export function Screen({ title, subtitle, action, children, className }: ScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-30"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          background: 'linear-gradient(180deg, rgba(8,9,12,0.92) 55%, rgba(8,9,12,0))',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          maskImage: 'linear-gradient(180deg, black 78%, transparent)',
          WebkitMaskImage: 'linear-gradient(180deg, black 78%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-md items-end justify-between gap-3 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <motion.h1
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="text-hero font-serif text-[2.1rem] leading-none tracking-tight"
            >
              {title}
            </motion.h1>
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="mt-1.5 truncate font-mono text-[11px] tracking-wide text-muted-foreground"
              >
                {subtitle}
              </motion.p>
            )}
          </div>
          {action && <div className="shrink-0 pb-0.5">{action}</div>}
        </div>
      </header>
      <main className={cn('mx-auto w-full max-w-md flex-1 px-4 pb-32 pt-2', className)}>
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

/* ── Staggered reveal helpers — wrap lists of cards for a premium entrance ── */

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}
