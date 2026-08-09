/** How Oto groups the people he meets. Order drives the People list sections. */
export const PEOPLE_CATEGORIES = [
  { id: 'gym', label: 'Gym', color: '#fb923c' },
  { id: 'dorm', label: 'Dorm', color: '#a78bfa' },
  { id: 'approached', label: 'Girls I approached', color: '#f0abfc' },
  { id: 'nus', label: 'NUS', color: '#7dd3fc' },
  { id: 'smu', label: 'SMU', color: '#4ade80' },
  { id: 'street', label: 'Met on the street', color: '#fbbf24' },
  { id: 'business', label: 'Business', color: '#c9f158' },
  { id: 'other', label: 'Other', color: '#8b8d95' },
] as const

export type PeopleCategoryId = (typeof PEOPLE_CATEGORIES)[number]['id']

const BY_ID = new Map(PEOPLE_CATEGORIES.map((c) => [c.id, c]))

export function categoryMeta(id?: string) {
  return BY_ID.get((id ?? 'other') as PeopleCategoryId) ?? BY_ID.get('other')!
}
