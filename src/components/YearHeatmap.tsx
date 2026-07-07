import { useEffect, useMemo, useRef } from 'react'
import { addDaysISO, todayISO, shortDate } from '@/lib/dates'

interface YearHeatmapProps {
  /** date (YYYY-MM-DD) → intensity value (any positive scale). */
  data: Record<string, number>
  color: string
  /** How many weeks of history to render. */
  weeks?: number
}

/**
 * GitHub-style consistency grid: one column per week, one cell per day,
 * brightness = value relative to the period max. Scrolls to today.
 */
export function YearHeatmap({ data, color, weeks = 52 }: YearHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { grid, max, total } = useMemo(() => {
    const today = todayISO()
    const todayDow = (new Date(`${today}T00:00:00`).getDay() + 6) % 7 // Mon=0
    const end = addDaysISO(today, 6 - todayDow) // end of current week (Sun)
    const days = weeks * 7
    const cells: { date: string; value: number; future: boolean }[] = []
    let maxV = 0
    let count = 0
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysISO(end, -i)
      const value = data[date] ?? 0
      if (value > maxV) maxV = value
      if (value > 0 && date <= today) count++
      cells.push({ date, value, future: date > today })
    }
    // column-major: weeks as columns
    const cols: (typeof cells)[] = []
    for (let w = 0; w < weeks; w++) cols.push(cells.slice(w * 7, w * 7 + 7))
    return { grid: cols, max: maxV || 1, total: count }
  }, [data, weeks])

  useEffect(() => {
    // land on the most recent weeks
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [grid])

  return (
    <div>
      <div ref={scrollRef} className="no-scrollbar overflow-x-auto">
        <div className="flex gap-[3px]" style={{ width: 'max-content' }}>
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={`${shortDate(cell.date)}: ${cell.value || '—'}`}
                  className="size-[9px] rounded-[2.5px]"
                  style={{
                    backgroundColor: cell.future
                      ? 'transparent'
                      : cell.value > 0
                        ? color
                        : 'rgba(255,255,255,0.06)',
                    opacity: cell.future ? 0 : cell.value > 0 ? 0.25 + 0.75 * (cell.value / max) : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        {total} day{total === 1 ? '' : 's'} logged · last {weeks} weeks
      </p>
    </div>
  )
}
