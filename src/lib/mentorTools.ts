/**
 * Tools the Mentor can call to WRITE to the store — "log 4h study" in chat
 * becomes a real log entry. Executors throw on bad input; the error text goes
 * back to the model as a tool error so it can correct itself.
 */
import type { ToolDef } from './anthropic'
import { todayISO } from './dates'
import { setStudyHours, setColdCalls } from '@/store/study'
import { setBusinessHours } from '@/store/business'
import { setBodyNumber } from '@/store/body'
import { setSocialRating } from '@/store/social'
import { createTask } from '@/store/tasks'
import { createContact } from '@/store/people'
import { createEvent } from '@/store/events'
import { store } from '@/store/store'
import { T } from '@/store/schema'

const dateProp = {
  type: 'string',
  description: 'YYYY-MM-DD; omit or empty for today',
} as const

function resolveDate(input: Record<string, unknown>): string {
  const d = typeof input.date === 'string' ? input.date.trim() : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayISO()
}

function needNumber(input: Record<string, unknown>, key: string, lo: number, hi: number): number {
  const n = Number(input[key])
  if (!Number.isFinite(n) || n < lo || n > hi) {
    throw new Error(`${key} must be a number between ${lo} and ${hi}`)
  }
  return n
}

function needString(input: Record<string, unknown>, key: string): string {
  const s = typeof input[key] === 'string' ? (input[key] as string).trim() : ''
  if (!s) throw new Error(`${key} is required`)
  return s
}

export const MENTOR_TOOLS: ToolDef[] = [
  {
    name: 'log_study_hours',
    description:
      "Set the user's total GMAT study hours for a day. Call when they report how long they studied.",
    input_schema: {
      type: 'object',
      properties: { hours: { type: 'number', description: 'Total hours, 0-24' }, date: dateProp },
      required: ['hours'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_cold_calls',
    description:
      "Add cold calls to the user's daily total. Call when they report calls made (adds to, not replaces, the day's count).",
    input_schema: {
      type: 'object',
      properties: { count: { type: 'number', description: 'Calls to add, 1-500' }, date: dateProp },
      required: ['count'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_business_hours',
    description: "Set the user's total business work hours for a day.",
    input_schema: {
      type: 'object',
      properties: { hours: { type: 'number', description: 'Total hours, 0-24' }, date: dateProp },
      required: ['hours'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_weight',
    description: "Log the user's body weight in kilograms for a day.",
    input_schema: {
      type: 'object',
      properties: { kg: { type: 'number', description: 'Weight in kg, 25-250' }, date: dateProp },
      required: ['kg'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_day_rating',
    description: 'Set the 1-10 rating for how the day went. Call when the user rates their day.',
    input_schema: {
      type: 'object',
      properties: { rating: { type: 'number', description: '1-10' }, date: dateProp },
      required: ['rating'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_task',
    description: 'Create a task on the to-do list. Call when the user asks to be reminded of or to add something to do.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title' },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        due: { type: 'string', description: 'YYYY-MM-DD due date, or empty' },
        category: {
          type: 'string',
          enum: ['personal', 'body', 'social', 'money', 'study'],
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_event',
    description: 'Add a calendar event. Call when the user mentions an appointment or plan with a date.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD (required)' },
        time: { type: 'string', description: 'HH:MM 24h, or empty for all-day' },
        category: { type: 'string', enum: ['personal', 'body', 'social', 'money', 'study'] },
      },
      required: ['title', 'date'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_contact',
    description: 'Add a person to the CRM. Call when the user describes someone they met.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        met: { type: 'string', description: 'How/where met, short' },
        notes: { type: 'string', description: 'Facts about the person, one per line' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
]

export const MENTOR_EXECUTORS: Record<string, (input: Record<string, unknown>) => string> = {
  log_study_hours(input) {
    const hours = needNumber(input, 'hours', 0, 24)
    const date = resolveDate(input)
    setStudyHours(date, hours)
    return `Logged ${hours}h GMAT study for ${date}`
  },
  log_cold_calls(input) {
    const count = Math.round(needNumber(input, 'count', 1, 500))
    const date = resolveDate(input)
    const current = Number(store.getCell(T.cv, date, 'calls') ?? 0)
    setColdCalls(date, current + count)
    return `Added ${count} calls — ${current + count} total for ${date}`
  },
  log_business_hours(input) {
    const hours = needNumber(input, 'hours', 0, 24)
    const date = resolveDate(input)
    setBusinessHours(date, hours)
    return `Logged ${hours}h business work for ${date}`
  },
  log_weight(input) {
    const kg = needNumber(input, 'kg', 25, 250)
    const date = resolveDate(input)
    setBodyNumber(date, 'weight', String(kg))
    return `Logged ${kg}kg for ${date}`
  },
  set_day_rating(input) {
    const rating = Math.round(needNumber(input, 'rating', 1, 10))
    const date = resolveDate(input)
    setSocialRating(date, rating)
    return `Day rated ${rating}/10 for ${date}`
  },
  add_task(input) {
    const title = needString(input, 'title')
    const priority = input.priority === 'high' || input.priority === 'low' ? input.priority : 'med'
    const due = typeof input.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.due) ? input.due : undefined
    const category = typeof input.category === 'string' ? input.category : undefined
    createTask({ title, priority, due, category })
    return `Task added: "${title}"${due ? ` (due ${due})` : ''}`
  },
  add_event(input) {
    const title = needString(input, 'title')
    const date = needString(input, 'date')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD')
    const time = typeof input.time === 'string' && /^\d{2}:\d{2}$/.test(input.time) ? input.time : ''
    const category = typeof input.category === 'string' ? input.category : 'personal'
    createEvent({ title, date, time, category })
    return `Event added: "${title}" on ${date}${time ? ` at ${time}` : ''}`
  },
  add_contact(input) {
    const name = needString(input, 'name')
    createContact({
      name,
      met: typeof input.met === 'string' ? input.met : '',
      notes: typeof input.notes === 'string' ? input.notes : '',
      lastContact: todayISO(),
    })
    return `${name} added to People`
  },
}
