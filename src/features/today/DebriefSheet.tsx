import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Mic, Square, Sparkles, Loader2, Check, CircleAlert, ChevronRight } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSpeech } from '@/lib/voice'
import { AnthropicError } from '@/lib/anthropic'
import { runDebrief, type DebriefOutcome } from '@/lib/debrief'
import { useDebrief } from '@/store/debrief'
import { toast } from 'sonner'

/**
 * The nightly debrief: talk through the whole day once, and the AI files it —
 * tracker numbers, new people, interactions, calendar events and tomorrow's
 * plan. The raw recording is kept in the journal either way.
 */
export function DebriefCard({ date }: { date: string }) {
  const [open, setOpen] = useState(false)
  const done = useDebrief(date) != null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass edge-light pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Mic className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Evening debrief</span>
          <span className="block font-mono text-[11px] text-muted-foreground">
            {done ? 'Recorded today — tap to redo' : 'Tell me about your day, I’ll file it all'}
          </span>
        </span>
        {done ? (
          <Check className="size-4 shrink-0 text-primary" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      <DebriefSheet open={open} onOpenChange={setOpen} date={date} />
    </>
  )
}

export function DebriefSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  date: string
}) {
  const speech = useSpeech()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<DebriefOutcome[] | null>(null)
  const mirroredLen = useRef(0)

  // Append newly-finalised speech as a delta so manual edits survive dictation.
  useEffect(() => {
    const t = speech.transcript
    if (t.length > mirroredLen.current) {
      const delta = t.slice(mirroredLen.current).trim()
      if (delta) setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${delta}` : delta))
    }
    mirroredLen.current = t.length
  }, [speech.transcript])

  useEffect(() => {
    if (!open) {
      speech.stop() // otherwise the auto-restarting mic outlives the sheet
      return
    }
    setText('')
    setBusy(false)
    setResults(null)
    mirroredLen.current = 0
    speech.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (speech.error) toast.error(speech.error)
  }, [speech.error])

  const live = text + (speech.interim ? ` ${speech.interim}` : '')

  async function handleProcess() {
    const t = live.trim()
    if (!t) {
      toast.error('Say or type something first')
      return
    }
    if (speech.listening) speech.stop()
    setBusy(true)
    try {
      const out = await runDebrief(t, date)
      setResults(out)
    } catch (err) {
      toast.error(err instanceof AnthropicError ? err.message : 'AI request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent
        side="bottom"
        className="glass-heavy mx-auto flex max-h-[92dvh] max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-3xl border-0 px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)]"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <Mic className="size-5 text-primary" /> Evening debrief
          </SheetTitle>
        </SheetHeader>

        {results ? (
          <>
            <ul className="space-y-1.5">
              {results.map((r) => (
                <li key={r.domain} className="flex items-start gap-2.5 rounded-xl bg-secondary/30 px-3 py-2">
                  {r.ok ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {r.domain}
                    </span>
                    <span className="block text-sm">{r.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              Full recording saved to your journal.
            </p>
            <Button className="glow-primary w-full rounded-xl py-5" onClick={() => onOpenChange(false)}>
              Done — good night
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Talk through your whole day: work and study sessions, gym, people you met, plans that
              came up, and what tomorrow looks like. One take — the AI sorts it into the app.
            </p>

            <div className="flex flex-col items-center gap-3">
              {speech.supported ? (
                <>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => (speech.listening ? speech.stop() : speech.start())}
                    aria-label={speech.listening ? 'Stop recording' : 'Start recording'}
                    className={cn(
                      'flex size-20 items-center justify-center rounded-full transition-colors duration-300',
                      speech.listening
                        ? 'rec-pulse bg-primary text-primary-foreground'
                        : 'glass text-primary hover:bg-primary/10',
                    )}
                  >
                    {speech.listening ? (
                      <Square className="size-7 fill-current" />
                    ) : (
                      <Mic className="size-8" />
                    )}
                  </motion.button>
                  <p className="text-center font-mono text-[11px] text-muted-foreground">
                    {speech.listening ? 'Listening… tap to stop' : 'Tap to start talking'}
                  </p>
                </>
              ) : (
                <p className="text-center font-mono text-[11px] text-muted-foreground">
                  Use the 🎙 key on your keyboard to dictate.
                </p>
              )}

              <Textarea
                value={live}
                onChange={(e) => setText(e.target.value)}
                placeholder="Your words appear here — edit freely…"
                rows={7}
                className="bg-black/20"
                disabled={busy}
              />

              <Button
                className="glow-primary w-full rounded-xl py-5 text-[15px]"
                onClick={handleProcess}
                disabled={busy || !live.trim()}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Filing your day…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> File my day
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
