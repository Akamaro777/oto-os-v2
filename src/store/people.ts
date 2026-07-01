import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type Contact } from './schema'
import { newId } from '@/lib/ids'
import { todayISO, daysBetween } from '@/lib/dates'
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
}

export function createContact(input: ContactInput): string {
  const id = newId()
  const row: Cells = { name: input.name.trim(), ts: Date.now() }
  if (input.met?.trim()) row.met = input.met.trim()
  if (input.lastContact) row.lastContact = input.lastContact
  if (input.cadenceDays) row.cadenceDays = input.cadenceDays
  if (input.birthday?.trim()) row.birthday = input.birthday.trim()
  if (input.notes?.trim()) row.notes = input.notes.trim()
  store.setRow(T.contacts, id, row as Record<string, string | number | boolean>)
  return id
}

export function updateContact(id: string, patch: ContactInput): void {
  store.setCell(T.contacts, id, 'name', patch.name.trim())
  setOrClearString(id, 'met', patch.met)
  setOrClearString(id, 'lastContact', patch.lastContact)
  setOrClearString(id, 'birthday', patch.birthday)
  setOrClearString(id, 'notes', patch.notes)
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
  store.setCell(T.contacts, id, 'lastContact', todayISO())
}

export function deleteContact(id: string): void {
  store.delRow(T.contacts, id)
}
