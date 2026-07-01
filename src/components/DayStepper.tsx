import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addDaysISO, dayHeaderLabel, todayISO } from '@/lib/dates'

interface DayStepperProps {
  date: string
  onChange: (date: string) => void
}

/** Prev / label / next day control. Disables stepping past today. */
export function DayStepper({ date, onChange }: DayStepperProps) {
  const isToday = date === todayISO()
  return (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addDaysISO(date, -1))}
        aria-label="Previous day"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <span className="font-mono text-sm text-muted-foreground">{dayHeaderLabel(date)}</span>
      <Button
        variant="ghost"
        size="icon"
        disabled={isToday}
        onClick={() => onChange(addDaysISO(date, 1))}
        aria-label="Next day"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  )
}
