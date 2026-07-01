import { useEffect, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { addMeal, addMeals } from '@/store/body'
import { getSetting } from '@/store/settings'
import { extractMeals, AnthropicError } from '@/lib/anthropic'
import { toast } from 'sonner'

interface MealLoggerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
}

type Mode = 'ai' | 'manual'

export function MealLoggerDialog({ open, onOpenChange, date }: MealLoggerDialogProps) {
  const [mode, setMode] = useState<Mode>('ai')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [cal, setCal] = useState('')
  const [prot, setProt] = useState('')

  useEffect(() => {
    if (!open) return
    setMode('ai')
    setText('')
    setName('')
    setCal('')
    setProt('')
    setBusy(false)
  }, [open])

  async function handleEstimate() {
    const desc = text.trim()
    if (!desc) {
      toast.error('Describe what you ate')
      return
    }
    const key = getSetting('apiKey')
    if (!key) {
      toast.error('Add your Anthropic API key in Settings first')
      return
    }
    setBusy(true)
    try {
      const meals = await extractMeals(key, desc)
      if (meals.length === 0) {
        toast.error('No meals detected — try describing them differently')
        return
      }
      addMeals(date, meals)
      const totalCal = meals.reduce((s, m) => s + m.cal, 0)
      toast.success(`Logged ${meals.length} item${meals.length > 1 ? 's' : ''} · ${totalCal} kcal`)
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof AnthropicError ? err.message : 'AI request failed'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  function handleManualAdd() {
    const n = name.trim()
    if (!n) {
      toast.error('Enter a meal name')
      return
    }
    addMeal(date, { name: n, cal: Number(cal) || 0, prot: Number(prot) || 0 })
    toast.success('Meal added')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Log a meal</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(['ai', 'manual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors',
                mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {m === 'ai' ? 'AI estimate' : 'Manual'}
            </button>
          ))}
        </div>

        {mode === 'ai' ? (
          <div className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="e.g. 3 eggs, 4 slices of buttered bread with ham, 2 coffees with sugar"
              autoFocus
            />
            <Button className="w-full" onClick={handleEstimate} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Estimating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Estimate macros with AI
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="meal-name">Meal</Label>
              <Input
                id="meal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chicken and rice"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="meal-cal">Calories</Label>
                <Input
                  id="meal-cal"
                  type="number"
                  inputMode="numeric"
                  value={cal}
                  onChange={(e) => setCal(e.target.value)}
                  placeholder="kcal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meal-prot">Protein</Label>
                <Input
                  id="meal-prot"
                  type="number"
                  inputMode="numeric"
                  value={prot}
                  onChange={(e) => setProt(e.target.value)}
                  placeholder="grams"
                />
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full" onClick={handleManualAdd}>
                Add meal
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
