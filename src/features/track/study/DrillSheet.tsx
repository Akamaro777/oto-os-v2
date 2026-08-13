import { useEffect, useMemo, useState } from 'react'
import { Brain, Check, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { type GmatError } from '@/store/schema'
import { drillDueErrors, recordDrillResult, useGmatErrors } from '@/store/study'
import { PILLAR_META } from '@/lib/pillars'
import { shortDate } from '@/lib/dates'
import { celebrate } from '@/lib/celebrate'

const SECTION_LABEL: Record<string, string> = { quant: 'Quant', verbal: 'Verbal', di: 'Data Insights' }
const REASON_LABEL: Record<string, string> = {
  concept: "didn't know the concept",
  careless: 'careless slip',
  time: 'ran out of time',
}

/**
 * Error-log drill: spaced repetition over logged wrong questions. "Beat it
 * cold?" — the same engine as the People recall quiz, aimed at the mistake
 * sheet the review days keep telling you to redo.
 */
export function DrillSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const errors = useGmatErrors()
  // The deck snapshots when the sheet opens — answering must not reshuffle it.
  const [deckIds, setDeckIds] = useState<string[]>([])
  useEffect(() => {
    if (open) setDeckIds(drillDueErrors(errors).slice(0, 10).map((e) => e.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const byId = useMemo(() => new Map(errors.map((e) => [e.id, e])), [errors])
  const deck = useMemo(
    () => deckIds.map((id) => byId.get(id)).filter((e): e is GmatError => e != null),
    [deckIds, byId],
  )
  const [index, setIndex] = useState(0)

  function reset(o: boolean) {
    if (!o) setIndex(0)
    onOpenChange(o)
  }

  function answer(beatIt: boolean) {
    const item = deck[index]
    if (item) recordDrillResult(item.id, beatIt)
    if (beatIt && index + 1 >= deck.length) celebrate()
    setIndex((i) => i + 1)
  }

  const item = deck[index]
  const done = open && (deck.length === 0 || index >= deck.length)
  const color = PILLAR_META.cv.color

  return (
    <Sheet open={open} onOpenChange={reset}>
      <SheetContent
        side="bottom"
        className="glass-heavy mx-auto flex max-h-[90dvh] max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-3xl border-0 px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)]"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <Brain className="size-5" style={{ color }} /> Drill
            {deck.length > 0 && index < deck.length && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {index + 1}/{deck.length}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {done ? (
          <div className="py-8 text-center">
            <p className="font-serif text-2xl">Mistake sheet cleared 🎉</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {deck.length === 0
                ? 'Nothing due for review right now.'
                : `${deck.length} errors drilled. Come back tomorrow.`}
            </p>
          </div>
        ) : item ? (
          <div className="space-y-5">
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {SECTION_LABEL[item.section] ?? item.section}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  logged {shortDate(item.date)}
                </span>
              </div>
              <p className="font-serif text-3xl capitalize">{item.topic}</p>
              {item.reason && (
                <p className="font-mono text-[11px] text-muted-foreground">
                  last time: {REASON_LABEL[item.reason] ?? item.reason}
                </p>
              )}
              {item.note && (
                <p className="mx-auto max-w-[300px] whitespace-pre-line rounded-xl bg-secondary/40 p-3 text-left text-sm text-muted-foreground">
                  {item.note}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Redo this question type cold. Did you beat it?
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => answer(false)}>
                <X className="size-4 text-destructive" /> Missed again
              </Button>
              <Button className="flex-1" onClick={() => answer(true)}>
                <Check className="size-4" /> Beat it
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/** Study-tab entry point: due count + open button. */
export function useDrillDueCount(): number {
  const errors = useGmatErrors()
  return useMemo(() => drillDueErrors(errors).length, [errors])
}
