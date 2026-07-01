import { ArrowUpRight } from 'lucide-react'
import { type Project } from '@/store/schema'
import { PILLAR_META, resolvePillar, pillarColor } from '@/lib/pillars'
import { PROJECT_STATUS_META } from '@/lib/projectStatus'

interface ProjectCardProps {
  project: Project
  openTasks: number
  onEdit: (project: Project) => void
}

export function ProjectCard({ project, openTasks, onEdit }: ProjectCardProps) {
  const status = PROJECT_STATUS_META[project.status]
  const pillar = PILLAR_META[resolvePillar(project.category)]

  return (
    <button
      type="button"
      onClick={() => onEdit(project)}
      className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-muted-foreground/30"
      style={{ borderLeftColor: pillarColor(project.category), borderLeftWidth: 2 }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate font-medium">{project.name}</h3>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
          style={{ color: status.color, backgroundColor: `${status.color}1a` }}
        >
          {status.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {project.nextAction ? (
          <>
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
              Next{' '}
            </span>
            {project.nextAction}
          </>
        ) : (
          <span className="text-muted-foreground/50">No next action set</span>
        )}
      </p>

      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>
          {pillar.label}
          {openTasks > 0 && ` · ${openTasks} task${openTasks > 1 ? 's' : ''}`}
        </span>
        {project.link && (
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            open <ArrowUpRight className="size-3" />
          </a>
        )}
      </div>
    </button>
  )
}
