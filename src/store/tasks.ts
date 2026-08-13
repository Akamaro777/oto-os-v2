import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type Priority, type Task } from './schema'
import { newId } from '@/lib/ids'
import { todayISO } from '@/lib/dates'

type Cells = Record<string, string | number | boolean | undefined>

function rowToTask(id: string, row: Cells): Task {
  const priority = row.priority as Priority
  return {
    id,
    title: String(row.title ?? ''),
    notes: row.notes != null ? String(row.notes) : undefined,
    // Guard the domain, not just the type — an imported "medium" would make
    // the sort comparator return NaN and the list order flicker.
    priority: priority in PRIORITY_RANK ? priority : 'med',
    due: row.due ? String(row.due) : undefined,
    category: row.category ? String(row.category) : undefined,
    projectId: row.projectId ? String(row.projectId) : undefined,
    done: Boolean(row.done),
    createdTs: Number(row.createdTs ?? 0),
    doneTs: row.doneTs != null ? Number(row.doneTs) : undefined,
  }
}

/** Reactive list of all tasks. */
export function useAllTasks(): Task[] {
  const table = useTable(T.tasks, store) as Record<string, Cells>
  return useMemo(
    () => Object.entries(table).map(([id, row]) => rowToTask(id, row)),
    [table],
  )
}

/* ── Selectors (pure) ── */

export type TaskFilter = 'open' | 'today' | 'overdue' | 'done'

export function filterTasks(tasks: Task[], filter: TaskFilter, today = todayISO()): Task[] {
  switch (filter) {
    case 'open':
      return tasks.filter((t) => !t.done)
    case 'today':
      return tasks.filter((t) => !t.done && t.due === today)
    case 'overdue':
      return tasks.filter((t) => !t.done && t.due != null && t.due < today)
    case 'done':
      return tasks.filter((t) => t.done)
  }
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 }

/** Sort: undone first, then priority, then soonest due (undated last), then oldest. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (a.due !== b.due) {
      if (!a.due) return 1
      if (!b.due) return -1
      return a.due < b.due ? -1 : 1
    }
    return a.createdTs - b.createdTs
  })
}

export function countOpenByFilter(tasks: Task[], today = todayISO()): Record<TaskFilter, number> {
  return {
    open: filterTasks(tasks, 'open', today).length,
    today: filterTasks(tasks, 'today', today).length,
    overdue: filterTasks(tasks, 'overdue', today).length,
    done: filterTasks(tasks, 'done', today).length,
  }
}

/* ── Mutations ── */

export interface TaskInput {
  title: string
  notes?: string
  priority?: Priority
  due?: string
  category?: string
  projectId?: string
}

export function createTask(input: TaskInput): string {
  const id = newId()
  const row: Cells = {
    title: input.title.trim(),
    priority: input.priority ?? 'med',
    done: false,
    createdTs: Date.now(),
  }
  if (input.notes?.trim()) row.notes = input.notes.trim()
  if (input.due) row.due = input.due
  if (input.category) row.category = input.category
  if (input.projectId) row.projectId = input.projectId
  store.setRow(T.tasks, id, row as Record<string, string | number | boolean>)
  return id
}

/** Update mutable fields. Empty-string / undefined optional fields are cleared. */
export function updateTask(id: string, patch: Partial<TaskInput>): void {
  const clearable: (keyof TaskInput)[] = ['notes', 'due', 'category', 'projectId']
  for (const key of clearable) {
    if (key in patch) {
      const value = patch[key]
      if (value == null || value === '') store.delCell(T.tasks, id, key)
      else store.setCell(T.tasks, id, key, value)
    }
  }
  if (patch.title != null) store.setCell(T.tasks, id, 'title', patch.title.trim())
  if (patch.priority != null) store.setCell(T.tasks, id, 'priority', patch.priority)
}

export function toggleTask(id: string): void {
  const done = !store.getCell(T.tasks, id, 'done')
  store.setCell(T.tasks, id, 'done', done)
  if (done) store.setCell(T.tasks, id, 'doneTs', Date.now())
  else store.delCell(T.tasks, id, 'doneTs')
}

export function deleteTask(id: string): void {
  store.delRow(T.tasks, id)
}

/** Re-create a deleted task under its original id (undo for swipe-delete). */
export function restoreTask(task: Task): void {
  const row: Cells = {
    title: task.title,
    priority: task.priority,
    done: task.done,
    createdTs: task.createdTs,
  }
  if (task.notes) row.notes = task.notes
  if (task.due) row.due = task.due
  if (task.category) row.category = task.category
  if (task.projectId) row.projectId = task.projectId
  if (task.doneTs != null) row.doneTs = task.doneTs
  store.setRow(T.tasks, task.id, row as Record<string, string | number | boolean>)
}
