import type { TablesSchema, ValuesSchema } from 'tinybase'

/* ──────────────────────────────────────────────────────────────────────────
 * Enums / shared unions
 * ────────────────────────────────────────────────────────────────────────── */

export const PILLARS = ['body', 'social', 'money', 'cv', 'personal'] as const
export type Pillar = (typeof PILLARS)[number]

export const PRIORITIES = ['high', 'med', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PROJECT_STATUSES = ['idea', 'active', 'paused', 'done'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

/* ──────────────────────────────────────────────────────────────────────────
 * Row types (our strict view of each table; rowId is carried as `id`)
 * Field names mirror v1 for clean migration (SPEC.md → Data model).
 * ────────────────────────────────────────────────────────────────────────── */

export interface Task {
  id: string
  title: string
  notes?: string
  priority: Priority
  due?: string // YYYY-MM-DD
  category?: string
  projectId?: string
  done: boolean
  createdTs: number
  doneTs?: number
}

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  nextAction?: string
  link?: string
  notes?: string
  category?: string
  createdTs: number
  updatedTs: number
  archived: boolean
}

export interface Contact {
  id: string
  name: string
  met?: string
  notes?: string
  lastContact?: string // YYYY-MM-DD
  cadenceDays?: number
  birthday?: string // YYYY-MM-DD
  ts: number
  /** Small JPEG data-URL thumbnail (face memory). */
  photo?: string
  /** Comma-separated tags, e.g. "nus,business". */
  tags?: string
  /** Recall-quiz spaced-repetition state. */
  quizLevel?: number
  quizDue?: string // YYYY-MM-DD
}

/** A client/deal in the money pipeline; closed deals sum into live MRR. */
export interface Deal {
  id: string
  name: string
  mrr: number // €/month
  status: string // 'lead' | 'talking' | 'closed' | 'lost'
  notes?: string
  ts: number
}

/** A visited country for the travel objective. */
export interface CountryVisit {
  id: string
  name: string
  date: string // YYYY-MM-DD
  ts: number
}

/** One wrong GMAT question — the error log that powers Weak Spots. */
export interface GmatError {
  id: string
  date: string // YYYY-MM-DD
  section: string // 'quant' | 'verbal' | 'di'
  topic: string
  reason: string // 'concept' | 'careless' | 'time' | ''
  note?: string
  ts: number
}

/** One logged conversation with a contact (relationship memory timeline). */
export interface Interaction {
  id: string
  contactId: string
  date: string // YYYY-MM-DD
  note: string
  ts: number
}

export interface Idea {
  id: string
  title: string
  notes?: string
  ts: number
}

export interface PortfolioEntry {
  id: string
  date: string // YYYY-MM-DD
  value: number
  ts: number
  source?: string // 't212' | 'manual'
  free?: number
  invested?: number
  ppl?: number
}

export interface CvGoal {
  id: string
  title: string
  deadline?: string // YYYY-MM-DD
  priority: Priority
  desc?: string
  done: boolean
  ts: number
}

export interface CalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  category?: string
  notes?: string
  ts: number
}

export interface MockExam {
  id: string
  date: string
  score: number
  ts: number
}

/** Daily body log (rowId = YYYY-MM-DD). */
export interface BodyLog {
  date: string
  weight?: number
  sleep?: number
  water?: number
  gym: boolean
  gymNotes?: string
  cardio: boolean
  cardioKm?: number
  cardioMin?: number
}

/** Daily social log (rowId = YYYY-MM-DD). */
export interface SocialLog {
  date: string
  rating?: number
  approaches?: number
  compliments?: number
  connections?: number
  note?: string
}

/** Daily money/business log (rowId = YYYY-MM-DD). */
export interface MoneyLog {
  date: string
  hours?: number
  type?: string
  notes?: string
}

/** Daily study/cv log (rowId = YYYY-MM-DD). */
export interface CvLog {
  date: string
  problems?: number
  correct?: number
  time?: number
  topic?: string
  studyHours?: number
  linkedin?: number
  calls?: number
  netNotes?: string
}

/** Weekly training grid (rowId = 'YYYY-Www'); each cell holds the date the session was done. */
export interface GymWeek {
  week: string
  push?: string
  pull?: string
  legs?: string
  shoulders?: string
  abs?: string
  stretch?: string
  run?: string
}

/** A time-blocking planner block. */
export interface Block {
  id: string
  date: string // YYYY-MM-DD
  start: string // HH:MM
  end: string // HH:MM
  title: string
  category?: string
  done: boolean
  taskId?: string
}

/** A Top-3 priority slot for a given day. */
export interface Top3Slot {
  id: string
  date: string // YYYY-MM-DD
  slot: number // 0..2
  text: string
  taskId?: string
}

export interface InboxItem {
  id: string
  text: string
  ts: number
  triaged: boolean
}

export interface ChatMessage {
  id: string
  role: string // 'user' | 'assistant'
  content: string
  ts: number
}

export interface BusinessPlan {
  date: string
  text: string
  ts: number
}

/** Daily non-negotiable rules checklist (rowId = YYYY-MM-DD). */
export interface RulesLog {
  date: string
  deepwork: boolean // 3h phone-free GMAT deep work
  noon: boolean // out of the house by 12:00
  calls: boolean // 70 cold calls
  run: boolean // Sunday run
}

/* ──────────────────────────────────────────────────────────────────────────
 * Table id constants
 * ────────────────────────────────────────────────────────────────────────── */

export const T = {
  tasks: 'tasks',
  projects: 'projects',
  contacts: 'contacts',
  ideas: 'ideas',
  portfolio: 'portfolio',
  cvGoals: 'cvGoals',
  events: 'events',
  mockExams: 'mockExams',
  body: 'body',
  social: 'social',
  money: 'money',
  cv: 'cv',
  gymSessions: 'gymSessions',
  blocks: 'blocks',
  top3: 'top3',
  inbox: 'inbox',
  chat: 'chat',
  businessPlans: 'businessPlans',
  rules: 'rules',
  deals: 'deals',
  countries: 'countries',
  gmatErrors: 'gmatErrors',
  interactions: 'interactions',
} as const

/* ──────────────────────────────────────────────────────────────────────────
 * TinyBase schemas (runtime integrity). Cells absent from a schema are dropped.
 * ────────────────────────────────────────────────────────────────────────── */

export const tablesSchema: TablesSchema = {
  tasks: {
    title: { type: 'string' },
    notes: { type: 'string' },
    priority: { type: 'string', default: 'med' },
    due: { type: 'string' },
    category: { type: 'string' },
    projectId: { type: 'string' },
    done: { type: 'boolean', default: false },
    createdTs: { type: 'number' },
    doneTs: { type: 'number' },
  },
  projects: {
    name: { type: 'string' },
    status: { type: 'string', default: 'idea' },
    nextAction: { type: 'string' },
    link: { type: 'string' },
    notes: { type: 'string' },
    category: { type: 'string' },
    createdTs: { type: 'number' },
    updatedTs: { type: 'number' },
    archived: { type: 'boolean', default: false },
  },
  contacts: {
    name: { type: 'string' },
    met: { type: 'string' },
    notes: { type: 'string' },
    lastContact: { type: 'string' },
    cadenceDays: { type: 'number' },
    birthday: { type: 'string' },
    ts: { type: 'number' },
    photo: { type: 'string' },
    tags: { type: 'string' },
    quizLevel: { type: 'number' },
    quizDue: { type: 'string' },
  },
  ideas: {
    title: { type: 'string' },
    notes: { type: 'string' },
    ts: { type: 'number' },
  },
  portfolio: {
    date: { type: 'string' },
    value: { type: 'number' },
    ts: { type: 'number' },
    source: { type: 'string' },
    free: { type: 'number' },
    invested: { type: 'number' },
    ppl: { type: 'number' },
  },
  cvGoals: {
    title: { type: 'string' },
    deadline: { type: 'string' },
    priority: { type: 'string', default: 'med' },
    desc: { type: 'string' },
    done: { type: 'boolean', default: false },
    ts: { type: 'number' },
  },
  events: {
    title: { type: 'string' },
    date: { type: 'string' },
    time: { type: 'string' },
    category: { type: 'string' },
    notes: { type: 'string' },
    ts: { type: 'number' },
  },
  mockExams: {
    date: { type: 'string' },
    score: { type: 'number' },
    ts: { type: 'number' },
  },
  body: {
    weight: { type: 'number' },
    sleep: { type: 'number' },
    water: { type: 'number' },
    gym: { type: 'boolean', default: false },
    gymNotes: { type: 'string' },
    cardio: { type: 'boolean', default: false },
    cardioKm: { type: 'number' },
    cardioMin: { type: 'number' },
  },
  social: {
    rating: { type: 'number' },
    approaches: { type: 'number' },
    compliments: { type: 'number' },
    connections: { type: 'number' },
    note: { type: 'string' },
  },
  money: {
    hours: { type: 'number' },
    type: { type: 'string' },
    notes: { type: 'string' },
  },
  cv: {
    problems: { type: 'number' },
    correct: { type: 'number' },
    time: { type: 'number' },
    topic: { type: 'string' },
    studyHours: { type: 'number' },
    linkedin: { type: 'number' },
    calls: { type: 'number' },
    netNotes: { type: 'string' },
  },
  gymSessions: {
    push: { type: 'string' },
    pull: { type: 'string' },
    legs: { type: 'string' },
    shoulders: { type: 'string' },
    abs: { type: 'string' },
    stretch: { type: 'string' },
    run: { type: 'string' },
  },
  blocks: {
    date: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    title: { type: 'string' },
    category: { type: 'string' },
    done: { type: 'boolean', default: false },
    taskId: { type: 'string' },
  },
  top3: {
    date: { type: 'string' },
    slot: { type: 'number', default: 0 },
    text: { type: 'string' },
    taskId: { type: 'string' },
  },
  inbox: {
    text: { type: 'string' },
    ts: { type: 'number' },
    triaged: { type: 'boolean', default: false },
  },
  chat: {
    role: { type: 'string' },
    content: { type: 'string' },
    ts: { type: 'number' },
  },
  businessPlans: {
    text: { type: 'string' },
    ts: { type: 'number' },
  },
  rules: {
    deepwork: { type: 'boolean', default: false },
    noon: { type: 'boolean', default: false },
    calls: { type: 'boolean', default: false },
    run: { type: 'boolean', default: false },
  },
  deals: {
    name: { type: 'string' },
    mrr: { type: 'number', default: 0 },
    status: { type: 'string', default: 'lead' },
    notes: { type: 'string' },
    ts: { type: 'number' },
  },
  countries: {
    name: { type: 'string' },
    date: { type: 'string' },
    ts: { type: 'number' },
  },
  gmatErrors: {
    date: { type: 'string' },
    section: { type: 'string' },
    topic: { type: 'string' },
    reason: { type: 'string' },
    note: { type: 'string' },
    ts: { type: 'number' },
  },
  interactions: {
    contactId: { type: 'string' },
    date: { type: 'string' },
    note: { type: 'string' },
    ts: { type: 'number' },
  },
}

/* ──────────────────────────────────────────────────────────────────────────
 * Values: profile.* and settings.* (namespaced flat keys)
 * ────────────────────────────────────────────────────────────────────────── */

export const valuesSchema: ValuesSchema = {
  // Profile — targets & goal dates
  'profile.name': { type: 'string', default: 'Oto' },
  'profile.weight': { type: 'number', default: 74 },
  'profile.targetWeight': { type: 'number', default: 79 },
  'profile.bizTarget': { type: 'number', default: 4 },
  'profile.studyTarget': { type: 'number', default: 3 },
  'profile.bulkTargetWeight': { type: 'number', default: 75 },
  'profile.bulkTargetDate': { type: 'string', default: '2026-05-17' },
  'profile.cutTargetWeight': { type: 'number', default: 67 },
  'profile.cutTargetDate': { type: 'string', default: '2026-08-05' },
  'profile.portfolioTarget': { type: 'number', default: 10000 },
  'profile.portfolioTargetDate': { type: 'string', default: '2026-12-01' },
  'profile.gmatTargetDate': { type: 'string', default: '2026-09-20' },
  'profile.gmatTargetScore': { type: 'number', default: 705 },
  'profile.bizCumulativeTarget': { type: 'number', default: 468 },
  'profile.bizCumulativeDate': { type: 'string', default: '2026-12-01' },
  'profile.bizCumulativeStart': { type: 'string', default: '2026-08-06' },
  'profile.dayStart': { type: 'string', default: '07:00' },
  'profile.dayEnd': { type: 'string', default: '24:00' },
  // Extended targets present in v1 export
  'profile.gmatDailyTarget': { type: 'number', default: 50 },
  'profile.gmatCumulativeTarget': { type: 'number', default: 4300 },
  'profile.gmatCumulativeDate': { type: 'string', default: '2026-08-01' },
  'profile.gmatScoreTarget': { type: 'number', default: 700 },
  'profile.gmatScoreTargetDate': { type: 'string', default: '2027-01-30' },
  'profile.socialApproachTarget': { type: 'number', default: 86 },
  'profile.socialComplimentTarget': { type: 'number', default: 86 },
  'profile.socialConnectionTarget': { type: 'number', default: 86 },
  'profile.socialCumulativeDate': { type: 'string', default: '2026-08-01' },
  'profile.socialDailyApproaches': { type: 'number', default: 1 },
  'profile.socialDailyCompliments': { type: 'number', default: 1 },
  'profile.socialDailyConnections': { type: 'number', default: 1 },
  // Milestones v2 (Aug–Dec 2026) — see store/migrations.ts
  'profile.milestonesVersion': { type: 'number', default: 0 },
  'profile.mrr': { type: 'number', default: 0 },
  'profile.mrrTarget': { type: 'number', default: 5000 },
  'profile.mrrTargetDate': { type: 'string', default: '2026-12-01' },
  'profile.mrrStartDate': { type: 'string', default: '2026-08-06' },
  'profile.countriesVisited': { type: 'number', default: 0 },
  'profile.countriesTarget': { type: 'number', default: 12 },
  'profile.countriesTargetDate': { type: 'string', default: '2026-12-01' },
  'profile.countriesStartDate': { type: 'string', default: '2026-08-06' },
  'profile.bodiesCount': { type: 'number', default: 0 },
  'profile.bodiesTarget': { type: 'number', default: 30 },
  'profile.bodiesTargetDate': { type: 'string', default: '2026-12-01' },
  'profile.bodiesStartDate': { type: 'string', default: '2026-08-06' },
  'profile.callsDailyTarget': { type: 'number', default: 70 },
  // Settings — secrets live here at runtime only (never committed)
  'settings.theme': { type: 'string', default: 'dark' },
  'settings.apiKey': { type: 'string', default: '' },
  'settings.jbKey': { type: 'string', default: '' },
  'settings.jbBinId': { type: 'string', default: '' },
  'settings.t212ProxyUrl': { type: 'string', default: '' },
  'settings.t212ProxySecret': { type: 'string', default: '' },
  'settings.syncUrl': { type: 'string', default: '' },
  'settings.syncSecret': { type: 'string', default: '' },
}
