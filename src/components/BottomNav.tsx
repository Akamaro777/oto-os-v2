import { motion } from 'motion/react'
import { NAV_TABS, type TabId } from '@/lib/nav'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  active: TabId
  onChange: (id: TabId) => void
}

/** Floating glass pill navigation with a spring-animated active indicator. */
export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-4"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
    >
      <ul className="glass-heavy mx-auto flex max-w-md items-stretch justify-between rounded-3xl px-1.5 py-1.5">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === active
          return (
            <li key={tab.id} className="relative flex-1">
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-2xl bg-primary/12"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(201,241,88,0.18), 0 0 18px rgba(201,241,88,0.10)' }}
                />
              )}
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'pressable relative flex w-full flex-col items-center gap-0.5 rounded-2xl py-2 text-[9.5px] font-medium transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-[19px]" strokeWidth={isActive ? 2.3 : 1.7} />
                <span className="tracking-wide">{tab.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
