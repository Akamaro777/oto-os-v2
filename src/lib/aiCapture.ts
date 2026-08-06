/**
 * Voice → structured data. Each capture takes a free-speech transcript, has a
 * Haiku-class model extract strict JSON, and applies it to the TinyBase store.
 * Every capture returns a short human summary for the confirmation toast.
 */
import { format, parseISO } from 'date-fns'
import { callMessages, MODELS, AnthropicError } from './anthropic'
import { getSetting } from '@/store/settings'
import { store } from '@/store/store'
import { T } from '@/store/schema'
import { todayISO, tomorrowISO } from './dates'
import { createTask } from '@/store/tasks'
import { createBlock, setTop3 } from '@/store/planner'
import { createProject, type ProjectInput } from '@/store/projects'
import { createContact, type ContactInput } from '@/store/people'
import { setBodyNumber } from '@/store/body'
import { setBusinessHours } from '@/store/business'
import { setStudyHours } from '@/store/study'
import { setSocialRating } from '@/store/social'
import type { Priority, ProjectStatus } from '@/store/schema'

const PILLAR_HINT = `"category" must be one of: personal, body, social, money, study.`

/** Prepended to every capture prompt — the input is speech-to-text, not typed prose. */
const TRANSCRIPT_HINT = `The user input is a raw speech-to-text transcript: expect mis-heard words, missing punctuation, run-on numbers and filler words. Infer the intended meaning from context (e.g. "way 74" = weight 74, "for our steady" = 4h study) rather than taking odd words literally.`

async function extract(system: string, text: string): Promise<Record<string, unknown>> {
  const key = getSetting('apiKey')
  if (!key) throw new AnthropicError('Add your Anthropic API key in Settings first.')
  const raw = await callMessages(key, {
    model: MODELS.haiku,
    maxTokens: 1500,
    system: `${TRANSCRIPT_HINT}\n${system}`,
    messages: [{ role: 'user', content: text }],
  })
  let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1)
  try {
    return JSON.parse(s) as Record<string, unknown>
  } catch {
    throw new AnthropicError('Could not parse the AI response — try rephrasing.')
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const asPriority = (v: unknown): Priority =>
  v === 'high' || v === 'low' ? v : 'med'

/* ── Plan my day ── */

/** Apply an extracted plan payload (top3 / blocks / tasks) to the store. */
function applyPlanData(data: Record<string, unknown>, date: string): string {
  let blocks = 0
  for (const b of arr(data.blocks)) {
    const o = b as Record<string, unknown>
    const title = str(o.title)
    const start = /^\d{2}:\d{2}$/.test(str(o.start)) ? str(o.start) : ''
    if (!title || !start) continue
    createBlock(date, {
      title,
      start,
      end: /^\d{2}:\d{2}$/.test(str(o.end)) ? str(o.end) : '',
      category: str(o.category) || 'personal',
    })
    blocks++
  }

  const top3 = arr(data.top3).map(str).filter(Boolean).slice(0, 3)
  top3.forEach((t, i) => setTop3(date, i, t))

  let tasks = 0
  for (const t of arr(data.tasks)) {
    const o = t as Record<string, unknown>
    const title = str(o.title)
    if (!title) continue
    createTask({
      title,
      priority: asPriority(o.priority),
      due: /^\d{4}-\d{2}-\d{2}$/.test(str(o.due)) ? str(o.due) : undefined,
      category: str(o.category) || undefined,
    })
    tasks++
  }

  const parts = []
  if (blocks) parts.push(`${blocks} block${blocks > 1 ? 's' : ''}`)
  if (top3.length) parts.push(`Top ${top3.length}`)
  if (tasks) parts.push(`${tasks} task${tasks > 1 ? 's' : ''}`)
  if (!parts.length) throw new AnthropicError('Nothing plannable detected — try again with more detail.')
  return `Planned: ${parts.join(' · ')}`
}

const PLAN_SHAPE = `Return ONLY JSON: {"top3": string[] (max 3, the most important outcomes),
"blocks": [{"title": string, "start": "HH:MM", "end": "HH:MM", "category": string}],
"tasks": [{"title": string, "priority": "high"|"med"|"low", "due": "YYYY-MM-DD"|"", "category": string}]}.
${PILLAR_HINT} Keep titles short (2-6 words). No prose.`

/** Voice-dictated day plan. */
export async function captureDayPlan(text: string, date: string): Promise<string> {
  const today = todayISO()
  const system = `You turn a spoken day-planning ramble into a structured plan. Target date: ${date} (today is ${today}).
Time blocks: infer sensible times between 07:00-23:00 if not stated; 60-120min defaults. Standalone to-dos go in "tasks".
${PLAN_SHAPE}`
  const data = await extract(system, text)
  return applyPlanData(data, date)
}

/** Recent planned days rendered as few-shot examples so auto-plan mimics Oto's real habits. */
function planningHistory(before: string, maxDays = 10): string[] {
  const blocksTable = store.getTable(T.blocks)
  const top3Table = store.getTable(T.top3)
  const days = [...new Set(
    Object.values(blocksTable)
      .map((b) => String(b.date ?? ''))
      .filter((d) => d && d < before),
  )]
    .sort()
    .slice(-maxDays)
  return days.map((d) => {
    const blocks = Object.values(blocksTable)
      .filter((b) => b.date === d)
      .sort((a, b) => String(a.start).localeCompare(String(b.start)))
      .map(
        (b) =>
          `${b.start}${b.end ? `–${b.end}` : ''} ${b.title} [${b.category || 'personal'}]${b.done ? ' ✓' : ''}`,
      )
      .join(' · ')
    const top3 = Object.values(top3Table)
      .filter((t) => t.date === d && String(t.text ?? '').trim())
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map((t) => t.text)
      .join(' / ')
    return `- ${format(parseISO(d), 'EEE')} ${d}: ${blocks}${top3 ? ` | Top3: ${top3}` : ''}`
  })
}

/** One-tap agentic planning: builds a full day from tasks, events, goals and free gaps. */
export async function autoPlanDay(date: string): Promise<string> {
  const key = getSetting('apiKey')
  if (!key) throw new AnthropicError('Add your Anthropic API key in Settings first.')

  // Gather live context from the store.
  const tasksTable = store.getTable(T.tasks)
  const openTasks = Object.values(tasksTable)
    .filter((t) => !t.done)
    .map((t) => `- ${t.title} [priority ${t.priority ?? 'med'}${t.due ? `, due ${t.due}` : ''}${t.category ? `, ${t.category}` : ''}]`)
    .slice(0, 20)
  const eventsTable = store.getTable(T.events)
  const events = Object.values(eventsTable)
    .filter((e) => e.date === date)
    .map((e) => `- ${e.time || 'all day'} ${e.title}`)
  const blocksTable = store.getTable(T.blocks)
  const existing = Object.values(blocksTable)
    .filter((b) => b.date === date)
    .map((b) => `- ${b.start}${b.end ? `–${b.end}` : ''} ${b.title}`)
  const p = (k: string) => store.getValue(`profile.${k}`)
  const history = planningHistory(date)

  const context = `Date to plan: ${date} (today is ${todayISO()}).
Day window: ${p('dayStart') ?? '07:00'}–${p('dayEnd') ?? '24:00'}.
Daily targets: ${p('bizTarget')}h business work, ${p('studyTarget')}h GMAT study, ${p('callsDailyTarget') ?? 70} cold calls, gym most days.
Non-negotiable daily rules:
- The first 3 hours of the day are phone-free GMAT deep work — schedule this block first, right at the day start.
- Out of the house by 12:00 — plan the day so he leaves by then.
- ${p('callsDailyTarget') ?? 70} cold calls — reserve a dedicated block for them.
Calendar events (fixed, do NOT create blocks that overlap them):
${events.length ? events.join('\n') : '- none'}
Blocks already planned (do NOT duplicate or overlap):
${existing.length ? existing.join('\n') : '- none'}
Open tasks:
${openTasks.length ? openTasks.join('\n') : '- none'}
How Oto planned his recent days (✓ = block actually completed — his real habits):
${history.length ? history.join('\n') : '- no planning history yet'}

Build the strongest realistic day IN OTO'S OWN STYLE: study the history above and mirror his patterns — typical start time, block lengths, how he names blocks, recurring routines (gym time, meals, calls) and what he actually completes (✓). The plan should read like one he would have written himself, while still honoring the non-negotiable rules. Schedule deep work early, include GMAT and business blocks to hit the daily targets, slot high-priority/overdue tasks, add a gym block, leave sensible breaks. Pick a Top 3 focused on the highest-leverage outcomes. Only add "tasks" entries if something important is clearly missing.`

  const raw = await callMessages(key, {
    model: MODELS.sonnet,
    maxTokens: 1500,
    system: `You are an elite personal scheduler. ${PLAN_SHAPE}`,
    messages: [{ role: 'user', content: context }],
  })
  let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1)
  let data: Record<string, unknown>
  try {
    data = JSON.parse(s) as Record<string, unknown>
  } catch {
    throw new AnthropicError('Could not parse the AI plan — try again.')
  }
  return applyPlanData(data, date)
}

/* ── New project ── */

export async function captureProject(text: string): Promise<string> {
  const system = `You turn a spoken project description into structured fields.
Return ONLY JSON: {"name": string (short project name), "status": "idea"|"active"|"paused"|"done",
"category": string, "nextAction": string (the very next concrete step), "notes": string (context worth keeping), "link": string ("" if none)}.
${PILLAR_HINT} No prose.`
  const data = await extract(system, text)
  const name = str(data.name)
  if (!name) throw new AnthropicError('No project name detected.')
  const status = (['idea', 'active', 'paused', 'done'] as const).includes(
    data.status as ProjectStatus,
  )
    ? (data.status as ProjectStatus)
    : 'idea'
  const input: ProjectInput = {
    name,
    status,
    category: str(data.category) || 'money',
    nextAction: str(data.nextAction),
    notes: str(data.notes),
    link: str(data.link),
  }
  createProject(input)
  return `Project "${name}" created${input.nextAction ? ` · next: ${input.nextAction}` : ''}`
}

/* ── New person ── */

export async function captureContact(text: string): Promise<string> {
  const system = `You turn a spoken description of a person into CRM fields.
Return ONLY JSON: {"name": string, "met": string (how/where met, short), "cadenceDays": number (reconnect interval in days, 0 if not mentioned),
"birthday": string ("MM-DD" or ""), "notes": string (anything worth remembering)}. No prose.`
  const data = await extract(system, text)
  const name = str(data.name)
  if (!name) throw new AnthropicError('No name detected.')
  const input: ContactInput = {
    name,
    met: str(data.met),
    cadenceDays: num(data.cadenceDays) ?? 0,
    birthday: /^\d{2}-\d{2}$/.test(str(data.birthday)) ? str(data.birthday) : '',
    notes: str(data.notes),
    lastContact: todayISO(),
  }
  createContact(input)
  return `${name} added to People`
}

/* ── New calendar event(s) ── */

export async function captureEvents(text: string): Promise<string> {
  const today = todayISO()
  const system = `You turn spoken plans into calendar events. Today is ${today}.
Return ONLY JSON: {"events": [{"title": string, "date": "YYYY-MM-DD", "time": "HH:MM" or "", "category": "personal"|"body"|"social"|"money"|"study", "notes": string}]}.
Resolve relative dates ("next Tuesday") from today. No prose.`
  const data = await extract(system, text)
  const { createEvent } = await import('@/store/events')
  let count = 0
  let firstTitle = ''
  for (const e of arr(data.events)) {
    const o = e as Record<string, unknown>
    const title = str(o.title)
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(o.date)) ? str(o.date) : ''
    if (!title || !date) continue
    createEvent({
      title,
      date,
      time: /^\d{2}:\d{2}$/.test(str(o.time)) ? str(o.time) : '',
      category: str(o.category) || 'personal',
      notes: str(o.notes),
    })
    if (!count) firstTitle = title
    count++
  }
  if (!count) throw new AnthropicError('No event detected — say what and when.')
  return count === 1 ? `Event added: ${firstTitle}` : `${count} events added`
}

/* ── Log my day (trackers) ── */

export async function captureDailyLog(text: string, date: string): Promise<string> {
  const system = `You turn a spoken daily check-in into tracker values. Extract ONLY what is explicitly mentioned.
Return ONLY JSON (omit or null anything not mentioned):
{"weight": number|null (kg), "sleep": number|null (hours),
"businessHours": number|null (hours worked on business), "studyHours": number|null (GMAT/study hours),
"rating": number|null (1-10 day rating)}. No prose.`
  const data = await extract(system, text)

  const parts: string[] = []
  const weight = num(data.weight)
  if (weight && weight > 25 && weight < 250) {
    setBodyNumber(date, 'weight', String(weight))
    parts.push(`${weight}kg`)
  }
  const sleep = num(data.sleep)
  if (sleep && sleep > 0 && sleep <= 16) {
    setBodyNumber(date, 'sleep', String(sleep))
    parts.push(`${sleep}h sleep`)
  }
  const biz = num(data.businessHours)
  if (biz != null && biz > 0 && biz <= 24) {
    setBusinessHours(date, biz)
    parts.push(`${biz}h business`)
  }
  const study = num(data.studyHours)
  if (study != null && study > 0 && study <= 24) {
    setStudyHours(date, study)
    parts.push(`${study}h study`)
  }
  const rating = num(data.rating)
  if (rating != null && rating >= 1 && rating <= 10) {
    setSocialRating(date, Math.round(rating))
    parts.push(`day ${Math.round(rating)}/10`)
  }

  if (!parts.length)
    throw new AnthropicError('Nothing loggable detected — mention weight, sleep, hours or a rating.')
  return `Logged: ${parts.join(' · ')}`
}

export { tomorrowISO }
