import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PILLARS, PROJECT_STATUSES, type Project, type ProjectStatus } from '@/store/schema'
import { PILLAR_META } from '@/lib/pillars'
import { PROJECT_STATUS_META } from '@/lib/projectStatus'
import {
  createProject,
  updateProject,
  deleteProject,
  toggleArchiveProject,
} from '@/store/projects'
import { toast } from 'sonner'

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project
}

export function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  const isEdit = project != null
  const [name, setName] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('active')
  const [category, setCategory] = useState('money')
  const [nextAction, setNextAction] = useState('')
  const [link, setLink] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setName(project?.name ?? '')
    setStatus(project?.status ?? 'active')
    setCategory(project?.category ?? 'money')
    setNextAction(project?.nextAction ?? '')
    setLink(project?.link ?? '')
    setNotes(project?.notes ?? '')
  }, [open, project])

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Give the project a name')
      return
    }
    const fields = { name: trimmed, status, category, nextAction, link, notes }
    if (isEdit) {
      updateProject(project.id, fields)
      toast.success('Project saved')
    } else {
      createProject(fields)
      toast.success('Project added')
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? 'Edit project' : 'New project'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span
                        className="mr-2 inline-block size-2 rounded-full align-middle"
                        style={{ backgroundColor: PROJECT_STATUS_META[s].color }}
                      />
                      {PROJECT_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pillar</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILLARS.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span
                        className="mr-2 inline-block size-2 rounded-full align-middle"
                        style={{ backgroundColor: PILLAR_META[p].color }}
                      />
                      {PILLAR_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-next">Next action</Label>
            <Input
              id="proj-next"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="The very next step"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-link">Link (repo / doc)</Label>
            <Input
              id="proj-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-notes">Notes</Label>
            <Textarea
              id="proj-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context, goals…"
              rows={3}
            />
          </div>

          {isEdit && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  toggleArchiveProject(project.id)
                  toast(project.archived ? 'Unarchived' : 'Archived')
                  onOpenChange(false)
                }}
              >
                {project.archived ? (
                  <>
                    <ArchiveRestore className="size-4" /> Unarchive
                  </>
                ) : (
                  <>
                    <Archive className="size-4" /> Archive
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => {
                  deleteProject(project.id)
                  toast('Project deleted')
                  onOpenChange(false)
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{isEdit ? 'Save' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
