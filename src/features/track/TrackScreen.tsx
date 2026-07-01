import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PILLAR_META } from '@/lib/pillars'
import { SettingsSheet } from '@/features/settings/SettingsSheet'
import { BodyTracker } from './body/BodyTracker'
import { SocialTracker } from './social/SocialTracker'
import { MoneyTracker } from './money/MoneyTracker'
import { BusinessTracker } from './business/BusinessTracker'
import { StudyTracker } from './study/StudyTracker'

type TrackTab = 'body' | 'social' | 'money' | 'biz' | 'study'

const TABS: { id: TrackTab; label: string; color: string }[] = [
  { id: 'body', label: 'Body', color: PILLAR_META.body.color },
  { id: 'social', label: 'Social', color: PILLAR_META.social.color },
  { id: 'money', label: 'Money', color: PILLAR_META.money.color },
  { id: 'biz', label: 'Biz', color: PILLAR_META.money.color },
  { id: 'study', label: 'Study', color: PILLAR_META.cv.color },
]

export function TrackScreen() {
  const [tab, setTab] = useState<TrackTab>('body')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <Screen
      title="Track"
      subtitle="body · social · money · biz · study"
      action={
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
        >
          <Settings2 className="size-5" />
        </Button>
      }
    >
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 font-mono text-xs transition-colors',
                active ? 'text-background' : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
              style={active ? { backgroundColor: t.color } : undefined}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'body' && <BodyTracker />}
      {tab === 'social' && <SocialTracker />}
      {tab === 'money' && <MoneyTracker />}
      {tab === 'biz' && <BusinessTracker />}
      {tab === 'study' && <StudyTracker />}

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Screen>
  )
}
