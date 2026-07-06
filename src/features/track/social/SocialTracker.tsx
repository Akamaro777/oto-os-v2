import { useState } from 'react'
import { motion } from 'motion/react'
import { TrackerCard } from '@/components/TrackerCard'
import { DayStepper } from '@/components/DayStepper'
import { LineTrend } from '@/components/charts'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/dates'
import { PILLAR_META } from '@/lib/pillars'
import { useSocialLog, setSocialRating, useSocialSeries } from '@/store/social'

const SOCIAL = PILLAR_META.social.color

const MOOD: Record<number, string> = {
  1: 'Rough', 2: 'Off', 3: 'Meh', 4: 'Flat', 5: 'Okay',
  6: 'Decent', 7: 'Good', 8: 'Great', 9: 'Excellent', 10: 'Perfect',
}

/** One question: how was your day? Rate it, see the trend, move on. */
export function SocialTracker() {
  const [date, setDate] = useState(todayISO())
  const log = useSocialLog(date)
  const series = useSocialSeries(7)

  return (
    <div className="space-y-4">
      <DayStepper date={date} onChange={setDate} />

      <TrackerCard title="How was your day?">
        <div className="mb-4 text-center">
          <motion.span
            key={`${date}-${log?.rating ?? 'none'}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-6xl"
            style={{ color: SOCIAL, textShadow: `0 0 24px ${SOCIAL}55` }}
          >
            {log?.rating ?? '—'}
          </motion.span>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {log?.rating ? MOOD[log.rating] : 'tap to rate'} · /10
          </p>
        </div>
        <div className="flex justify-between gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const filled = log?.rating != null && n <= log.rating
            return (
              <motion.button
                key={n}
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => setSocialRating(date, n)}
                aria-label={`Rate ${n}`}
                className={cn(
                  'h-10 flex-1 rounded-lg text-[11px] font-medium transition-all duration-200',
                  filled ? 'text-background' : 'bg-secondary text-muted-foreground',
                )}
                style={
                  filled
                    ? { backgroundColor: SOCIAL, boxShadow: `0 0 10px ${SOCIAL}40` }
                    : undefined
                }
              >
                {n}
              </motion.button>
            )
          })}
        </div>
      </TrackerCard>

      <TrackerCard title="Last 7 days">
        <LineTrend data={series} color={SOCIAL} unit="/10" height={150} />
      </TrackerCard>
    </div>
  )
}
