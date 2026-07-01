import { useEffect, useState } from 'react'
import { useTop3, setTop3 } from '@/store/planner'

interface Top3CardProps {
  date: string
}

export function Top3Card({ date }: Top3CardProps) {
  const values = useTop3(date)
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Top 3
      </h2>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Top3Row key={`${date}:${i}`} slot={i} value={values[i]} date={date} />
        ))}
      </div>
    </div>
  )
}

function Top3Row({ date, slot, value }: { date: string; slot: number; value: string }) {
  const [text, setText] = useState(value)

  // Re-sync when the underlying value changes (e.g. day switch).
  useEffect(() => setText(value), [value])

  function commit() {
    if (text !== value) setTop3(date, slot, text)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] text-muted-foreground">
        {slot + 1}
      </span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        placeholder={`Priority ${slot + 1}…`}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  )
}
