import { useMemo, useState } from 'react'
import { Brain, Check, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { type Contact } from '@/store/schema'
import { quizDueContacts, recordQuizResult } from '@/store/people'
import { celebrate } from '@/lib/celebrate'

interface QuizSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contacts: Contact[]
}

/**
 * Recall quiz: face/name → recall the rest, spaced repetition per person.
 * Five minutes a day and 10-new-people days stop being a blur.
 */
export function QuizSheet({ open, onOpenChange, contacts }: QuizSheetProps) {
  // Deck snapshots when the sheet opens; index walks through it.
  const deck = useMemo(() => (open ? quizDueContacts(contacts).slice(0, 15) : []), [open, contacts])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  function reset(o: boolean) {
    if (!o) {
      setIndex(0)
      setRevealed(false)
    }
    onOpenChange(o)
  }

  function answer(correct: boolean) {
    const person = deck[index]
    if (person) recordQuizResult(person.id, correct)
    if (correct && index + 1 >= deck.length) celebrate()
    setRevealed(false)
    setIndex((i) => i + 1)
  }

  const person = deck[index]
  const done = open && (deck.length === 0 || index >= deck.length)

  return (
    <Sheet open={open} onOpenChange={reset}>
      <SheetContent side="bottom" className="glass-heavy mx-auto flex max-h-[90dvh] max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-3xl border-0 px-5 pb-[max(env(safe-area-inset-bottom),2.5rem)]">
        <SheetHeader className="px-0">
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <Brain className="size-5 text-pillar-social" /> Recall
            {deck.length > 0 && index < deck.length && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {index + 1}/{deck.length}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {done ? (
          <div className="py-8 text-center">
            <p className="font-serif text-2xl">All caught up 🎉</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {deck.length === 0
                ? 'No one is due for review right now.'
                : `${deck.length} people reviewed. Come back tomorrow.`}
            </p>
          </div>
        ) : person ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3">
              <span className="flex size-28 items-center justify-center overflow-hidden rounded-full bg-secondary font-serif text-3xl">
                {person.photo ? (
                  <img src={person.photo} alt="" className="size-full object-cover" />
                ) : (
                  person.name.slice(0, 2).toUpperCase()
                )}
              </span>
              {revealed ? (
                <div className="space-y-1 text-center">
                  <p className="font-serif text-2xl">{person.name}</p>
                  {person.met && (
                    <p className="font-mono text-[11px] text-muted-foreground">{person.met}</p>
                  )}
                  {person.notes && (
                    <p className="mx-auto max-w-[280px] whitespace-pre-line text-sm text-muted-foreground">
                      {person.notes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {person.photo ? 'Who is this? Say their name and one fact.' : `${person.name} — recall where you met and one fact.`}
                </p>
              )}
            </div>

            {revealed ? (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => answer(false)}>
                  <X className="size-4 text-destructive" /> Missed it
                </Button>
                <Button className="flex-1" onClick={() => answer(true)}>
                  <Check className="size-4" /> Got it
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={() => setRevealed(true)}>
                Reveal
              </Button>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
