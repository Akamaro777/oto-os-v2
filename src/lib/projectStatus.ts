import type { ProjectStatus } from '@/store/schema'

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: '#c9f158' },
  idea: { label: 'Idea', color: '#7dd3fc' },
  paused: { label: 'Paused', color: '#fbbf24' },
  done: { label: 'Done', color: '#8b8d95' },
}
