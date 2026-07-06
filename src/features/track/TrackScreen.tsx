import { useState } from 'react'
import { Settings2, Mic } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { VoiceDialog } from '@/components/VoiceDialog'
import { cn } from '@/lib/utils'
import { PILLAR_META } from '@/lib/pillars'
import { todayISO } from '@/lib/dates'
import { captureDailyLog } from '@/lib/aiCapture'
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
  const [voiceOpen, setVoiceOpen] = useState(false)

  return (
    <Screen
      title="Track"
      subtitle="body · social · money · biz · study"
      action={
        <div className="flex gap-2">
          <Button
            size="icon"
            className="glow-primary rounded-full"
            onClick={() => setVoiceOpen(true)}
            aria-label="Log your day by voice"
          >
            <Mic className="size-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings2 className="size-5" />
          </Button>
        </div>
      }
    >
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'pressable shrink-0 rounded-full px-4 py-1.5 font-mono text-xs transition-all duration-200',
                active ? 'font-semibold text-background' : 'glass text-muted-foreground hover:text-foreground',
              )}
              style={
                active
                  ? { backgroundColor: t.color, boxShadow: `0 0 16px ${t.color}44` }
                  : undefined
              }
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
      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        title="Log your day"
        hint="Say it all at once — weight, sleep, food, hours, day rating"
        placeholder="e.g. Weighed 68.4, slept 7 and a half, had eggs and salmon then chicken with rice, 3 hours GMAT, 2 hours on the business, day was an 8…"
        process={(text) => captureDailyLog(text, todayISO())}
      />
    </Screen>
  )
}
