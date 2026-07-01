import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type Project, type ProjectStatus } from './schema'
import { newId } from '@/lib/ids'
import { useAllTasks } from './tasks'

type Cells = Record<string, string | number | boolean | undefined>

function rowToProject(id: string, row: Cells): Project {
  return {
    id,
    name: String(row.name ?? ''),
    status: (row.status as ProjectStatus) ?? 'idea',
    nextAction: row.nextAction ? String(row.nextAction) : undefined,
    link: row.link ? String(row.link) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    category: row.category ? String(row.category) : undefined,
    createdTs: Number(row.createdTs ?? 0),
    updatedTs: Number(row.updatedTs ?? 0),
    archived: Boolean(row.archived),
  }
}

const STATUS_RANK: Record<ProjectStatus, number> = { active: 0, idea: 1, paused: 2, done: 3 }

export function useAllProjects(): Project[] {
  const table = useTable(T.projects, store) as Record<string, Cells>
  return useMemo(() => Object.entries(table).map(([id, row]) => rowToProject(id, row)), [table])
}

/** Sort active-first by status, then most-recently-updated. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.updatedTs - a.updatedTs,
  )
}

/** Map of projectId → count of linked, not-done tasks. */
export function useOpenTaskCounts(): Record<string, number> {
  const tasks = useAllTasks()
  return useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tasks) {
      if (t.projectId && !t.done) counts[t.projectId] = (counts[t.projectId] ?? 0) + 1
    }
    return counts
  }, [tasks])
}

/* ── Mutations ── */

export interface ProjectInput {
  name: string
  status: ProjectStatus
  category?: string
  nextAction?: string
  link?: string
  notes?: string
}

export function createProject(input: ProjectInput): string {
  const id = newId()
  const now = Date.now()
  const row: Cells = {
    name: input.name.trim(),
    status: input.status,
    archived: false,
    createdTs: now,
    updatedTs: now,
  }
  if (input.category) row.category = input.category
  if (input.nextAction?.trim()) row.nextAction = input.nextAction.trim()
  if (input.link?.trim()) row.link = input.link.trim()
  if (input.notes?.trim()) row.notes = input.notes.trim()
  store.setRow(T.projects, id, row as Record<string, string | number | boolean>)
  return id
}

export function updateProject(id: string, patch: ProjectInput): void {
  store.setCell(T.projects, id, 'name', patch.name.trim())
  store.setCell(T.projects, id, 'status', patch.status)
  store.setCell(T.projects, id, 'updatedTs', Date.now())
  const optional: [keyof ProjectInput, string][] = [
    ['category', 'category'],
    ['nextAction', 'nextAction'],
    ['link', 'link'],
    ['notes', 'notes'],
  ]
  for (const [key, cell] of optional) {
    const value = patch[key]
    if (typeof value === 'string' && value.trim()) store.setCell(T.projects, id, cell, value.trim())
    else store.delCell(T.projects, id, cell)
  }
}

export function toggleArchiveProject(id: string): void {
  store.setCell(T.projects, id, 'archived', !store.getCell(T.projects, id, 'archived'))
  store.setCell(T.projects, id, 'updatedTs', Date.now())
}

export function deleteProject(id: string): void {
  store.delRow(T.projects, id)
}
