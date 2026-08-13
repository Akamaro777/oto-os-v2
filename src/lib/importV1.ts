import { setISOWeek, setISOWeekYear, startOfISOWeek } from 'date-fns'
import { store } from '@/store/store'
import { T, tablesSchema, valuesSchema } from '@/store/schema'
import { toISO } from './dates'

type Obj = Record<string, unknown>

const asObj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (v == null ? '' : String(v))
const bool = (v: unknown): boolean => v === true || v === 'true'

/** Monday (ISO) of a 'YYYY-Www' week key, for legacy boolean gym sessions.
 * Null for malformed keys — "NaN-NaN-NaN" must never reach the store. */
function isoWeekMonday(weekKey: string): string | null {
  const [y, w] = weekKey.split('-W')
  if (!y || !w || Number.isNaN(Number(y)) || Number.isNaN(Number(w))) return null
  let d = new Date(Number(y), 0, 4)
  d = setISOWeekYear(d, Number(y))
  d = setISOWeek(d, Number(w))
  const iso = toISO(startOfISOWeek(d))
  return iso.includes('NaN') ? null : iso
}

export interface ImportSummary {
  tables: Record<string, number>
  values: number
}

/** Keep only cells declared in the schema, coercing to the declared type. */
function cleanCells(table: keyof typeof tablesSchema, input: Obj): Record<string, string | number | boolean> {
  const schema = tablesSchema[table] as Record<string, { type: string }>
  const out: Record<string, string | number | boolean> = {}
  for (const [cell, def] of Object.entries(schema)) {
    const v = input[cell]
    if (v == null || v === '') continue
    if (def.type === 'number') {
      const n = Number(v)
      if (!Number.isNaN(n)) out[cell] = n
    } else if (def.type === 'boolean') {
      out[cell] = bool(v)
    } else {
      out[cell] = String(v)
    }
  }
  return out
}

/**
 * Import a v1 localStorage export into the TinyBase store. Field names already
 * mirror v1, so mapping is mostly structural. Runs in one transaction.
 */
export function importV1(raw: unknown): ImportSummary {
  const data = asObj(raw)
  const counts: Record<string, number> = {}
  let valueCount = 0
  const bump = (t: string) => (counts[t] = (counts[t] ?? 0) + 1)

  store.transaction(() => {
    // ── Values: profile.* and settings.* ──
    const profile = asObj(data.profile)
    const settings = asObj(data.settings)
    for (const key of Object.keys(valuesSchema)) {
      const [ns, field] = key.split('.')
      const src = ns === 'profile' ? profile : settings
      if (field in src && src[field] != null && src[field] !== '') {
        const def = valuesSchema[key] as { type: string }
        const v = src[field]
        if (def.type === 'number') {
          const n = Number(v)
          // Skip non-numeric junk ("74kg") — a NaN here renders everywhere.
          if (!Number.isNaN(n)) {
            store.setValue(key, n)
            valueCount++
          }
        } else {
          store.setValue(key, String(v))
          valueCount++
        }
      }
    }

    // ── Date-keyed daily logs ──
    for (const [table, srcKey] of [
      [T.body, 'body'],
      [T.social, 'social'],
      [T.money, 'money'],
      [T.cv, 'cv'],
    ] as const) {
      const map = asObj(data[srcKey])
      for (const [date, row] of Object.entries(map)) {
        const cells = cleanCells(table, asObj(row))
        if (Object.keys(cells).length === 0) continue // skip empty days (e.g. cv: {})
        store.setRow(table, date, cells)
        bump(table)
      }
    }

    // ── Portfolio: flatten detail{free,invested,ppl} ──
    asArr(data.portfolio).forEach((entry, i) => {
      const e = asObj(entry)
      const detail = asObj(e.detail)
      const id = e.ts != null ? `${String(e.ts)}-${i}` : `pf-${i}`
      store.setRow(T.portfolio, id, cleanCells(T.portfolio, { ...e, ...detail }))
      bump(T.portfolio)
    })

    // ── Id-keyed collections ──
    for (const [table, srcKey] of [
      [T.events, 'events'],
      [T.ideas, 'ideas'],
      [T.cvGoals, 'cvGoals'],
      [T.mockExams, 'mockExams'],
      [T.contacts, 'contacts'],
      [T.tasks, 'tasks'],
      [T.inbox, 'inbox'],
    ] as const) {
      asArr(data[srcKey]).forEach((item, i) => {
        const o = asObj(item)
        const id = o.id != null ? String(o.id) : `${srcKey}-${i}`
        store.setRow(table, id, cleanCells(table, o))
        bump(table)
      })
    }

    // ── gymSessions: normalise booleans → dates, drop falsy, map 'stretching' ──
    const gym = asObj(data.gymSessions)
    for (const [week, sessions] of Object.entries(gym)) {
      const row: Record<string, string> = {}
      for (const [rawKey, value] of Object.entries(asObj(sessions))) {
        const key = rawKey === 'stretching' ? 'stretch' : rawKey
        if (!(key in (tablesSchema[T.gymSessions] as Obj))) continue
        if (value === true) {
          const monday = isoWeekMonday(week)
          if (monday) row[key] = monday
        } else if (typeof value === 'string' && value) row[key] = value
        // false / falsy / unparseable week keys → dropped
      }
      if (Object.keys(row).length) {
        store.setRow(T.gymSessions, week, row)
        bump(T.gymSessions)
      }
    }

    // ── Planner: { date: { blocks:[], top3:[] } } ──
    const planner = asObj(data.planner)
    for (const [date, day] of Object.entries(planner)) {
      const d = asObj(day)
      asArr(d.blocks).forEach((block, i) => {
        const b = asObj(block)
        const id = b.id != null ? String(b.id) : `${date}-blk-${i}`
        store.setRow(T.blocks, id, cleanCells(T.blocks, { ...b, date }))
        bump(T.blocks)
      })
      asArr(d.top3).forEach((slot, i) => {
        const text = typeof slot === 'string' ? slot : str(asObj(slot).text)
        if (!text.trim()) return
        const taskId = typeof slot === 'string' ? '' : str(asObj(slot).taskId)
        store.setRow(T.top3, `${date}:${i}`, cleanCells(T.top3, { date, slot: i, text, taskId }))
        bump(T.top3)
      })
    }

    // ── businessPlans: { date: { text, ts } } ──
    const plans = asObj(data.businessPlans)
    for (const [date, plan] of Object.entries(plans)) {
      const p = asObj(plan)
      if (str(p.text).trim()) {
        store.setRow(T.businessPlans, date, cleanCells(T.businessPlans, p))
        bump(T.businessPlans)
      }
    }

    // ── chat: [ {role, content} ] ──
    asArr(data.chat).forEach((msg, i) => {
      const m = asObj(msg)
      store.setRow(T.chat, `chat-${i}`, cleanCells(T.chat, { ...m, ts: m.ts ?? i }))
      bump(T.chat)
    })
  })

  return { tables: counts, values: valueCount }
}
