/**
 * The nightly debrief: one long spoken ramble → routed into every tracker.
 * A Sonnet router splits the transcript into domain buckets (keeping the
 * speaker's wording), then each non-empty bucket runs through the existing
 * capture pipeline — same prompts, schemas and store writes as the one-shot
 * voice captures. The raw transcript is saved to the journal before any AI
 * runs, so a failed extraction never loses the recording.
 */
import { callMessages, MODELS, AnthropicError } from './anthropic'
import {
  TRANSCRIPT_HINT,
  parseExtractedJson,
  captureDayPlan,
  captureContact,
  captureDeal,
  captureEvents,
  captureDailyLog,
} from './aiCapture'
import { getSetting } from '@/store/settings'
import { store } from '@/store/store'
import { T } from '@/store/schema'
import { tomorrowISO } from './dates'
import { addInteraction } from '@/store/people'
import { toggleGymSession, isoWeekKey, GYM_SLOTS, type GymSlot } from '@/store/body'
import { saveDebrief, setDebriefSummary } from '@/store/debrief'

export interface DebriefOutcome {
  domain: string
  ok: boolean
  detail: string
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const GYM_KEYS = GYM_SLOTS.map((g) => g.key)

const ROUTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'dailyLog',
    'gymWent',
    'gymSlot',
    'gymNotes',
    'newPeople',
    'knownPeople',
    'events',
    'tomorrowPlan',
    'deal',
    'daySummary',
  ],
  properties: {
    dailyLog: { type: 'string' },
    gymWent: { type: 'boolean' },
    gymSlot: { type: 'string', enum: [...GYM_KEYS, ''] },
    gymNotes: { type: 'string' },
    newPeople: { type: 'string' },
    knownPeople: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, note: { type: 'string' } },
        required: ['name', 'note'],
        additionalProperties: false,
      },
    },
    events: { type: 'string' },
    tomorrowPlan: { type: 'string' },
    deal: { type: 'string' },
    daySummary: { type: 'string' },
  },
}

function routerPrompt(date: string, contactNames: string[]): string {
  return `${TRANSCRIPT_HINT}
You route a long end-of-day spoken debrief into the sections of a life-tracking app. Today is ${date}; tomorrow is ${tomorrowISO()}.
Copy the speaker's statements into every bucket they belong to, keeping his original wording (a sentence may appear in more than one bucket). Use "" / [] / false for buckets with nothing.
- "dailyLog": statements about business hours worked, GMAT/study hours, cold calls made, weight, sleep, or an overall day rating.
- "gymWent" + "gymSlot" + "gymNotes": whether he trained today, which session (${GYM_KEYS.join('/')}; "" if unclear) and any workout details.
- "newPeople": full descriptions of people he met for the FIRST time today — anyone NOT in the known-contacts list below. Keep every fact about each person.
- "knownPeople": people from the known-contacts list he mentioned today — "name" must be the EXACT name from the list, "note" is what happened with them today.
- "events": upcoming appointments or plans on a specific date/day ("on Friday", "next week"...), EXCLUDING the general plan for tomorrow.
- "tomorrowPlan": everything about what he intends to do tomorrow — schedule, priorities, tasks.
- "deal": progress on business clients/prospects for the sales pipeline.
- "daySummary": 2-3 plain sentences summarising the day, for his journal.
Known contacts: ${contactNames.length ? contactNames.join('; ') : 'none yet'}.`
}

function applyGym(date: string, slot: string, notes: string): string {
  store.setCell(T.body, date, 'gym', true)
  if (notes) store.setCell(T.body, date, 'gymNotes', notes)
  const valid = GYM_KEYS.includes(slot as GymSlot)
  if (valid) {
    const week = isoWeekKey(date)
    // Only tick an empty slot — toggling an already-done one would untick it.
    if (!store.getCell(T.gymSessions, week, slot)) toggleGymSession(week, slot as GymSlot, date)
  }
  return valid ? `Gym logged · ${slot} day` : 'Gym logged'
}

/** Interactions for people who already exist in the CRM. */
function applyKnownPeople(entries: { name: string; note: string }[], date: string): string {
  const contacts = store.getTable(T.contacts)
  const byName = new Map<string, string>()
  for (const [id, row] of Object.entries(contacts)) {
    const n = String(row.name ?? '').trim().toLowerCase()
    if (n && !byName.has(n)) byName.set(n, id)
  }
  const logged: string[] = []
  for (const e of entries) {
    const name = e.name.trim()
    if (!name) continue
    const lower = name.toLowerCase()
    const id =
      byName.get(lower) ??
      [...byName.entries()].find(([n]) => n.includes(lower) || lower.includes(n))?.[1]
    if (!id) continue
    if (e.note.trim()) addInteraction(id, e.note.trim(), date)
    logged.push(name)
  }
  if (!logged.length) throw new AnthropicError('Could not match the people mentioned.')
  return logged.length === 1
    ? `Caught up with ${logged[0]}`
    : `${logged.length} people: ${logged.slice(0, 3).join(', ')}${logged.length > 3 ? '…' : ''}`
}

/**
 * Run the full debrief. Returns one outcome per detected section — partial
 * failures (e.g. the events bucket erroring) don't stop the other sections.
 */
export async function runDebrief(text: string, date: string): Promise<DebriefOutcome[]> {
  const key = getSetting('apiKey')
  if (!key) throw new AnthropicError('Add your Anthropic API key in Settings first.')

  // The transcript is the source of truth — persist it before any AI runs.
  saveDebrief(date, text)

  const contactNames = Object.values(store.getTable(T.contacts))
    .map((c) => String(c.name ?? '').trim())
    .filter(Boolean)
    .slice(0, 250)

  const raw = await callMessages(key, {
    model: MODELS.sonnet,
    maxTokens: 6000,
    system: routerPrompt(date, contactNames),
    messages: [{ role: 'user', content: text }],
    failOnMaxTokens: true,
    jsonSchema: ROUTER_SCHEMA,
    disableThinking: true,
  })
  const data = parseExtractedJson(raw, 'Could not sort the debrief — try again.')

  const summary = str(data.daySummary)
  if (summary) setDebriefSummary(date, summary)

  const known = arr(data.knownPeople)
    .map((p) => {
      const o = p as Record<string, unknown>
      return { name: str(o.name), note: str(o.note) }
    })
    .filter((p) => p.name)

  const jobs: { domain: string; run: () => Promise<string> }[] = []
  const dailyLog = str(data.dailyLog)
  if (dailyLog) jobs.push({ domain: 'Trackers', run: () => captureDailyLog(dailyLog, date) })
  if (data.gymWent === true)
    jobs.push({ domain: 'Gym', run: async () => applyGym(date, str(data.gymSlot), str(data.gymNotes)) })
  const newPeople = str(data.newPeople)
  if (newPeople) jobs.push({ domain: 'New people', run: () => captureContact(newPeople) })
  if (known.length) jobs.push({ domain: 'Caught up with', run: async () => applyKnownPeople(known, date) })
  const events = str(data.events)
  if (events) jobs.push({ domain: 'Calendar', run: () => captureEvents(events) })
  const tomorrowPlan = str(data.tomorrowPlan)
  if (tomorrowPlan)
    jobs.push({ domain: 'Tomorrow', run: () => captureDayPlan(tomorrowPlan, tomorrowISO()) })
  const deal = str(data.deal)
  if (deal) jobs.push({ domain: 'Pipeline', run: () => captureDeal(deal) })

  if (!jobs.length) {
    throw new AnthropicError(
      'Nothing actionable detected — the recording was still saved to your journal.',
    )
  }

  const settled = await Promise.allSettled(jobs.map((j) => j.run()))
  return jobs.map((j, i) => {
    const r = settled[i]
    return r.status === 'fulfilled'
      ? { domain: j.domain, ok: true, detail: r.value }
      : {
          domain: j.domain,
          ok: false,
          detail: r.reason instanceof Error ? r.reason.message : 'Failed to apply',
        }
  })
}
