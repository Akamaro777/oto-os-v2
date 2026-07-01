import {
  Sun,
  CalendarDays,
  FolderKanban,
  Users,
  Activity,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export type TabId = 'today' | 'plan' | 'projects' | 'people' | 'track' | 'mentor'

export interface NavTab {
  id: TabId
  label: string
  icon: LucideIcon
}

export const NAV_TABS: readonly NavTab[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'plan', label: 'Plan', icon: CalendarDays },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'people', label: 'People', icon: Users },
  { id: 'track', label: 'Track', icon: Activity },
  { id: 'mentor', label: 'Mentor', icon: Sparkles },
] as const
