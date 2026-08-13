import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import Modal from '../shared/Modal'
import ErrorBanner from '../shared/ErrorBanner'

interface Skill {
  id: string
  title: string
  description: string
  body: string
}

// Meta's real constraint (docs/meta-api/skills.md): lowercase, numbers, hyphens
// only, no leading/trailing hyphen — e.g. "greeting-skill". Server-side
// enforcement of this pattern is a separate flagged gap (TASK-043) — this is
// a UX assist, not the only line of defense.
const TITLE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export default function SkillEditorModal({
  agentId,
  skill,
  librarySkillId,
  onClose,
}: {
  agentId: string
  skill: Skill | null
  /** Set when editing a Library-attached skill — saves to the shared Library
   * row (never touches Meta) instead of the legacy agent-scoped endpoint
   * (which still writes through to Meta immediately). */
  librarySkillId?: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(skill?.title ?? '')
  const [description, setDescription] = useState(skill?.description ?? '')
  const [body, setBody] = useState(skill?.body ?? '')
  const [error, setError] = useState<string | null>(null)

  const isEditing = skill !== null
  const isLibrary = librarySkillId != null
  const titleValid = title.length > 0 && title.length <= 64 && TITLE_PATTERN.test(title)

  const mutation = useMutation({
    mutationFn: () =>
      isLibrary
        ? api.put(`/skills/${librarySkillId}`, { title, description, body })
        : isEditing
          ? api.put(`/agents/${agentId}/skills/${skill.id}`, { title, description, body })
          : api.post(`/agents/${agentId}/skills`, { title, description, body }),
    onSuccess: () => {
      // SkillsTab reads only ['skills-view', agentId] now (TASK-050) — invalidate
      // that unconditionally, regardless of which endpoint this save hit.
      queryClient.invalidateQueries({ queryKey: ['skills-view', agentId] })
      // Also reused from SkillLibraryPage (TASK-053: that page now aggregates
      // legacy agent skills too, not just Library rows) — ANY save here,
      // library or legacy, may need to refresh that page's list. Partial key
      // (no wabaId) matches every ['library-skills', *] query; harmless no-op
      // when this modal isn't opened from that page.
      queryClient.invalidateQueries({ queryKey: ['library-skills'] })
      onClose()
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const inputCls =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

  return (
    <Modal
      title={isEditing ? 'Edit skill' : 'Add skill'}
      onClose={onClose}
      preventClose={mutation.isPending}
      maxWidthClassName="max-w-lg"
    >
      <div className="flex flex-col">
        <div>
          {error && (
            <div className="mb-3">
              <ErrorBanner error={error} />
            </div>
          )}

          {isLibrary && (
            <div className="mb-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              This skill is shared from the Library. Saving updates it everywhere it's attached — this agent won't reflect the change until you sync it.
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. handoff-guardrails"
                className={inputCls}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, hyphens only — e.g. <code>greeting-skill</code>
                </p>
                <p className="text-xs text-muted-foreground shrink-0 ml-2">{title.length}/64</p>
              </div>
              {title.length > 0 && !titleValid && (
                <p className="text-xs text-destructive">Doesn't match the required format.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell the agent WHEN to apply this skill — e.g. 'Apply when a customer asks about returns'"
                className={cn(inputCls, 'resize-none')}
              />
              <p className="text-xs text-muted-foreground text-right">{description.length}/1024</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Instructions</label>
              <textarea
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="The actual instructions the agent follows for this skill."
                className={cn(inputCls, 'resize-y font-mono text-xs leading-relaxed')}
              />
              <p className="text-xs text-muted-foreground text-right">{body.length.toLocaleString()}/20,000</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t shrink-0">
          <button
            onClick={() => { setError(null); mutation.mutate() }}
            disabled={mutation.isPending || !titleValid || !description.trim() || !body.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5
              text-sm font-semibold text-white transition-opacity hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {/* Library path never touches Meta (genuinely a draft — see the
                librarySkillId prop's own doc comment above); legacy
                agent-scoped path writes to Meta immediately. Label reflects
                which one this actually is (item 8, 2026-08-13), not a
                generic "Save" that would be accurate for neither case. */}
            {isLibrary ? 'Save draft' : (isEditing ? 'Publish changes' : 'Publish skill')}
          </button>
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold
              text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
