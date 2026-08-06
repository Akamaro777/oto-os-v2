import type { Pillar } from '@/store/schema'

export interface PillarMeta {
  id: Pillar
  label: string
  /** Hex, matches the CSS --pillar-* tokens (used for dots, charts, borders). */
  color: string
}

export const PILLAR_META: Record<Pillar, PillarMeta> = {
  body: { id: 'body', label: 'Body', color: '#fb923c' },
  social: { id: 'social', label: 'Social', color: '#f0abfc' },
  money: { id: 'money', label: 'Money', color: '#4ade80' },
  cv: { id: 'cv', label: 'Study', color: '#7dd3fc' },
  personal: { id: 'personal', label: 'Personal', color: '#8b8d95' },
}

/** Normalise any legacy/loose category string onto one of the five pillars. */
export function resolvePillar(category?: string): Pillar {
  switch (category) {
    case 'body':
      return 'body'
    case 'social':
      return 'social'
    case 'money':
      return 'money'
    case 'cv':
    case 'study':
    case 'work':
      return 'cv'
    default:
      return 'personal'
  }
}

export function pillarColor(category?: string): string {
  return PILLAR_META[resolvePillar(category)].color
}
