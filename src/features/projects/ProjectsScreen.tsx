import { useMemo, useState } from 'react'
import { FolderKanban, Plus } from 'lucide-react'
import { Screen, EmptyState } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { type Project } from '@/store/schema'
import { useAllProjects, sortProjects, useOpenTaskCounts } from '@/store/projects'
import { ProjectCard } from './ProjectCard'
import { ProjectDialog } from './ProjectDialog'

export function ProjectsScreen() {
  const projects = useAllProjects()
  const counts = useOpenTaskCounts()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Project | undefined>(undefined)

  const { active, archived } = useMemo(() => {
    const activeP = sortProjects(projects.filter((p) => !p.archived))
    const archivedP = sortProjects(projects.filter((p) => p.archived))
    return { active: activeP, archived: archivedP }
  }, [projects])

  return (
    <Screen
      title="Projects"
      subtitle={`${active.length} active`}
      action={
        <Button size="icon" className="rounded-full" onClick={() => setCreateOpen(true)}>
          <Plus className="size-5" />
        </Button>
      }
    >
      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-8" />}
          message="No projects yet — tap + to add one."
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((p) => (
                <ProjectCard key={p.id} project={p} openTasks={counts[p.id] ?? 0} onEdit={setEditing} />
              ))}
            </div>
          )}

          {archived.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Archived · {archived.length}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-3 opacity-60">
                {archived.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    openTasks={counts[p.id] ?? 0}
                    onEdit={setEditing}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ProjectDialog
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(undefined)}
        project={editing}
      />
    </Screen>
  )
}
