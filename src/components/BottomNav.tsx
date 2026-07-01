import { NAV_TABS, type TabId } from '@/lib/nav'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  active: TabId
  onChange: (id: TabId) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === active
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon
                  className={cn('size-5 transition-transform', isActive && '-translate-y-0.5')}
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
                <span className="tracking-wide">{tab.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
