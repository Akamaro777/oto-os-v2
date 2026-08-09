import { useMemo, useRef, useState } from 'react'
import { Camera, Loader2, Target } from 'lucide-react'
import { TrackerCard } from '@/components/TrackerCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PILLAR_META } from '@/lib/pillars'
import { todayISO, daysBetween } from '@/lib/dates'
import { fileToJpegDataURL } from '@/lib/images'
import { extractGmatPhoto, applyGmatExtract, type GmatPhotoExtract } from '@/lib/aiCapture'
import { AnthropicError } from '@/lib/anthropic'
import { getProfileNumber, getProfileString } from '@/store/profile'
import { useGmatErrors, useMockExams, aggregateWeakSpots } from '@/store/study'
import { toast } from 'sonner'

const CV = PILLAR_META.cv.color

const SECTION_LABEL: Record<string, string> = { quant: 'Quant', verbal: 'Verbal', di: 'Data Insights' }

/** Days-left countdown vs the target score, from logged mocks. */
export function GmatCountdownCard() {
  const mocks = useMockExams()
  const target = getProfileNumber('gmatTargetScore') || 705
  const targetDate = getProfileString('gmatTargetDate')
  const daysLeft = Math.max(0, daysBetween(todayISO(), targetDate))
  const latest = mocks.length ? mocks[mocks.length - 1].score : null

  return (
    <TrackerCard title="Exam countdown">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-serif text-4xl" style={{ color: CV, textShadow: `0 0 24px ${CV}44` }}>
            {daysLeft}
          </span>
          <span className="font-mono text-sm text-muted-foreground"> days to {targetDate.slice(5).replace('-', '/')}</span>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm">
            {latest ?? '—'} <span className="text-muted-foreground">→ {target}</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {latest != null ? `${Math.max(0, target - latest)} pts to go` : 'log a mock'}
          </p>
        </div>
      </div>
    </TrackerCard>
  )
}

/** Error-log aggregation: which topics are bleeding points and why. */
export function WeakSpotsCard() {
  const errors = useGmatErrors()
  const spots = useMemo(() => aggregateWeakSpots(errors), [errors])
  const max = spots[0]?.total ?? 1

  return (
    <TrackerCard
      title="Weak spots"
      action={
        <span className="font-mono text-[11px] text-muted-foreground">{errors.length} errors logged</span>
      }
    >
      {spots.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          No errors logged yet — snap a photo of a practice set or wrong-question list.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {spots.slice(0, 6).map((s) => {
            const reasons = Object.entries(s.byReason)
              .filter(([k]) => k !== 'unknown')
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => `${k} ${n}`)
              .join(' · ')
            return (
              <li key={`${s.section}:${s.topic}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm capitalize">{s.topic}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {SECTION_LABEL[s.section] ?? s.section} · {s.total}
                    {reasons ? ` (${reasons})` : ''}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(s.total / max) * 100}%`, backgroundColor: CV }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {spots.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
          <Target className="size-3" style={{ color: CV }} />
          Today's deep work target: {spots[0].topic}
        </p>
      )}
    </TrackerCard>
  )
}

/** Photo → AI extraction → confirm → save. Handles practice sets, mocks and error lists. */
export function GmatPhotoButton({ date }: { date: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [extract, setExtract] = useState<GmatPhotoExtract | null>(null)

  async function handleFile(file: File) {
    setBusy(true)
    try {
      const dataUrl = await fileToJpegDataURL(file, 1400)
      const result = await extractGmatPhoto(dataUrl)
      setExtract(result)
    } catch (err) {
      toast.error(err instanceof AnthropicError ? err.message : 'Could not read the photo')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!extract) return
    try {
      const summary = await applyGmatExtract(extract, date)
      toast.success(summary)
    } catch (err) {
      toast.error(err instanceof AnthropicError ? err.message : 'Save failed')
    }
    setExtract(null)
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
        {busy ? 'Reading…' : 'Photo'}
      </Button>

      <Dialog open={extract != null} onOpenChange={(o) => !o && setExtract(null)}>
        <DialogContent className="max-w-md gap-5">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Found in photo</DialogTitle>
          </DialogHeader>
          {extract && (
            <div className="space-y-3 text-sm">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {extract.kind} · {extract.date ?? date}
              </p>
              {extract.mockScore != null && (
                <p>
                  Mock score: <span className="font-mono" style={{ color: CV }}>{extract.mockScore}</span>
                </p>
              )}
              {extract.problems != null && (
                <p>
                  Practice: {extract.problems} problems
                  {extract.correct != null ? ` · ${extract.correct} correct` : ''}
                  {extract.topic ? ` · ${extract.topic}` : ''}
                </p>
              )}
              {extract.errors.length > 0 && (
                <div>
                  <p className="mb-1">{extract.errors.length} wrong questions:</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-secondary/40 p-2">
                    {extract.errors.map((e, i) => (
                      <li key={i} className="font-mono text-[11px] text-muted-foreground">
                        <span className="capitalize text-foreground">{e.topic}</span>
                        {' · '}
                        {SECTION_LABEL[e.section] ?? e.section}
                        {e.reason ? ` · ${e.reason}` : ''}
                        {e.note ? ` — ${e.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {extract.mockScore == null && extract.problems == null && extract.errors.length === 0 && (
                <p className="text-muted-foreground">Nothing usable detected — try a clearer photo.</p>
              )}
            </div>
          )}
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setExtract(null)}>
              Discard
            </Button>
            <Button onClick={handleConfirm}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
