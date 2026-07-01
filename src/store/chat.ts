import { useMemo } from 'react'
import { useTable } from 'tinybase/ui-react'
import { store } from './store'
import { T, type ChatMessage } from './schema'
import { newId } from '@/lib/ids'

type Cells = Record<string, string | number | boolean | undefined>

function rowToMessage(id: string, row: Cells): ChatMessage {
  return {
    id,
    role: String(row.role ?? 'user'),
    content: String(row.content ?? ''),
    ts: Number(row.ts ?? 0),
  }
}

export function useChatMessages(): ChatMessage[] {
  const table = useTable(T.chat, store) as Record<string, Cells>
  return useMemo(
    () => Object.entries(table).map(([id, row]) => rowToMessage(id, row)).sort((a, b) => a.ts - b.ts),
    [table],
  )
}

export function addChatMessage(role: 'user' | 'assistant', content: string): string {
  const id = newId()
  store.setRow(T.chat, id, { role, content, ts: Date.now() })
  return id
}

export function clearChat(): void {
  store.delTable(T.chat)
}
