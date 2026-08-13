import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Mic, Square, Sparkles, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSpeech } from '@/lib/voice'
import { AnthropicError } from '@/lib/anthropic'
import { toast } from 'sonner'

interface VoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Short guidance under the mic, e.g. what to say. */
  hint: string
  placeholder?: string
  /** Applies the transcript (AI extraction + store writes); returns a summary for the toast. */
  process: (text: string) => Promise<string>
}

/**
 * Speak → transcribe → AI-structure → done. The transcript stays editable, and
 * on devices without in-page speech the keyboard's dictation key does the job.
 */
export function VoiceDialog({ open, onOpenChange, title, hint, placeholder, process }: VoiceDialogProps) {
  const speech = useSpeech()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const mirroredLen = useRef(0)

  // Append newly-finalised speech to the editable field. Append the DELTA
  // only — replacing wholesale would wipe any manual corrections the user
  // typed mid-dictation.
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
      speech.stop() // otherwise the auto-restarting mic outlives the dialog
      return
    }
    setText('')
    setBusy(false)
    mirroredLen.current = 0
    speech.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (speech.error) toast.error(speech.error)
  }, [speech.error])

  async function handleCreate() {
    // Include the still-interim tail — finals lag by seconds on mobile, and
    // the words are visibly in the box when the user taps Create.
    const t = (text + (speech.interim ? ` ${speech.interim}` : '')).trim()
    if (!t) {
      toast.error('Say or type something first')
      return
    }
    if (speech.listening) speech.stop()
    setBusy(true)
    try {
      const summary = await process(t)
      toast.success(summary)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof AnthropicError ? err.message : 'AI request failed')
    } finally {
      setBusy(false)
    }
  }

  const live = text + (speech.interim ? ` ${speech.interim}` : '')

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="glass-heavy max-w-md gap-5 border-0">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
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
              <AnimatePresence mode="wait">
                <motion.p
                  key={speech.listening ? 'rec' : 'idle'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center font-mono text-[11px] text-muted-foreground"
                >
                  {speech.listening ? 'Listening… tap to stop' : hint}
                </motion.p>
              </AnimatePresence>
            </>
          ) : (
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              {hint} — use the 🎙 key on your keyboard to dictate.
            </p>
          )}

          <Textarea
            value={live}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder ?? 'Your words appear here — edit freely…'}
            rows={4}
            className="bg-black/20"
            disabled={busy}
          />

          <Button
            className="glow-primary w-full rounded-xl py-5 text-[15px]"
            onClick={handleCreate}
            disabled={busy || !live.trim()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Structuring with AI…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Create with AI
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
