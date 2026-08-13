import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type Contact, type Interaction } from './schema'
import { newId } from '@/lib/ids'
import { todayISO, addDaysISO, daysBetween } from '@/lib/dates'
import { reconnectDue } from '@/lib/people'

type Cells = Record<string, string | number | boolean | undefined>

function rowToContact(id: string, row: Cells): Contact {
  return {
    id,
    name: String(row.name ?? ''),
    met: row.met ? String(row.met) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    lastContact: row.lastContact ? String(row.lastContact) : undefined,
    cadenceDays: row.cadenceDays != null ? Number(row.cadenceDays) : undefined,
    birthday: row.birthday ? String(row.birthday) : undefined,
    ts: Number(row.ts ?? 0),
    photo: row.photo ? String(row.photo) : undefined,
    tags: row.tags ? String(row.tags) : undefined,
    category: row.category ? String(row.category) : undefined,
    instagram: row.instagram ? String(row.instagram) : undefined,
    quizLevel: row.quizLevel != null ? Number(row.quizLevel) : undefined,
    quizDue: row.quizDue ? String(row.quizDue) : undefined,
  }
}

export function useAllContacts(): Contact[] {
  const table = useTable(T.contacts, store) as Record<string, Cells>
  return useMemo(() => Object.entries(table).map(([id, row]) => rowToContact(id, row)), [table])
}

/** Longest-since-contact first; never-logged floats to the top. */
export function sortByRecency(contacts: Contact[], today = todayISO()): Contact[] {
  const since = (c: Contact) => (c.lastContact ? daysBetween(c.lastContact, today) : 99999)
  return [...contacts].sort((a, b) => since(b) - since(a))
}

export function reconnectDueContacts(contacts: Contact[], today = todayISO()): Contact[] {
  return contacts.filter((c) => reconnectDue(c, today))
}

/* ── Mutations ── */

export interface ContactInput {
  name: string
  met?: string
  lastContact?: string
  cadenceDays?: number
  birthday?: string
  notes?: string
  photo?: string
  tags?: string
  category?: string
  instagram?: string
}

export function createContact(input: ContactInput): string {
  const id = newId()
  const row: Cells = { name: input.name.trim(), ts: Date.now() }
  if (input.met?.trim()) row.met = input.met.trim()
  if (input.lastContact) row.lastContact = input.lastContact
  if (input.cadenceDays) row.cadenceDays = input.cadenceDays
  if (input.birthday?.trim()) row.birthday = input.birthday.trim()
  if (input.notes?.trim()) row.notes = input.notes.trim()
  if (input.photo) row.photo = input.photo
  if (input.tags?.trim()) row.tags = input.tags.trim()
  if (input.category?.trim()) row.category = input.category.trim()
  if (input.instagram?.trim()) row.instagram = input.instagram.trim().replace(/^@/, '')
  store.setRow(T.contacts, id, row as Record<string, string | number | boolean>)
  return id
}

export function updateContact(id: string, patch: ContactInput): void {
  store.setCell(T.contacts, id, 'name', patch.name.trim())
  setOrClearString(id, 'met', patch.met)
  setOrClearString(id, 'lastContact', patch.lastContact)
  setOrClearString(id, 'birthday', patch.birthday)
  setOrClearString(id, 'notes', patch.notes)
  setOrClearString(id, 'photo', patch.photo)
  setOrClearString(id, 'tags', patch.tags)
  setOrClearString(id, 'category', patch.category)
  setOrClearString(id, 'instagram', patch.instagram?.replace(/^@/, ''))
  if (patch.cadenceDays && patch.cadenceDays > 0) {
    store.setCell(T.contacts, id, 'cadenceDays', patch.cadenceDays)
  } else {
    store.delCell(T.contacts, id, 'cadenceDays')
  }
}

function setOrClearString(id: string, cell: string, value?: string): void {
  if (value && value.trim()) store.setCell(T.contacts, id, cell, value.trim())
  else store.delCell(T.contacts, id, cell)
}

/** Set last contact to today. */
export function logTouch(id: string): void {
  // hasRow guard: setCell on a deleted contact (e.g. removed on the other
  // device mid-session) would resurrect it as a nameless ghost row.
  if (!store.hasRow(T.contacts, id)) return
  store.setCell(T.contacts, id, 'lastContact', todayISO())
}

export function deleteContact(id: string): void {
  store.delRow(T.contacts, id)
  // Remove the person's interaction timeline too.
  const interactions = store.getTable(T.interactions)
  for (const [rowId, row] of Object.entries(interactions)) {
    if (row.contactId === id) store.delRow(T.interactions, rowId)
  }
}

/* ── Interactions: the relationship memory timeline ── */

export function useInteractions(contactId: string): Interaction[] {
  const table = useTable(T.interactions, store) as Record<string, Cells>
  return useMemo(
    () =>
      Object.entries(table)
        .filter(([, row]) => row.contactId === contactId)
        .map(([id, row]) => ({
          id,
          contactId,
          date: String(row.date ?? ''),
          note: String(row.note ?? ''),
          ts: Number(row.ts ?? 0),
        }))
        .sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts),
    [table, contactId],
  )
}

/** Log a conversation: adds a timeline note and bumps lastContact. */
export function addInteraction(contactId: string, note: string, date = todayISO()): string {
  const id = newId()
  store.setRow(T.interactions, id, { contactId, date, note: note.trim(), ts: Date.now() })
  if (store.hasRow(T.contacts, contactId)) {
    store.setCell(T.contacts, contactId, 'lastContact', date)
  }
  return id
}

export function deleteInteraction(id: string): void {
  store.delRow(T.interactions, id)
}

/* ── Recall quiz (spaced repetition over people) ── */

const QUIZ_INTERVALS = [1, 3, 7, 16, 35, 90] // days until next review per level

/** Contacts due for a recall round: never quizzed or due date reached. */
export function quizDueContacts(contacts: Contact[], today = todayISO()): Contact[] {
  return contacts
    .filter((c) => c.name && (!c.quizDue || c.quizDue <= today))
    .sort((a, b) => (a.quizLevel ?? 0) - (b.quizLevel ?? 0) || b.ts - a.ts)
}

/** Record a quiz answer: right → longer interval, wrong → back to daily. */
export function recordQuizResult(id: string, correct: boolean, today = todayISO()): void {
  if (!store.hasRow(T.contacts, id)) return
  const level = Number(store.getCell(T.contacts, id, 'quizLevel') ?? 0)
  const next = correct ? Math.min(level + 1, QUIZ_INTERVALS.length) : 0
  store.setCell(T.contacts, id, 'quizLevel', next)
  store.setCell(
    T.contacts,
    id,
    'quizDue',
    addDaysISO(today, QUIZ_INTERVALS[Math.min(next, QUIZ_INTERVALS.length - 1)]),
  )
}
