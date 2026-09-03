import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import Modal from '../shared/Modal'
import ErrorBanner from '../shared/ErrorBanner'

export interface UiSkill {
  id: string
  title: string
  componentType: string
  status: 'enabled' | 'disabled'
  instruction: string
  /** Separate from `status` above (a Meta-side enabled/disabled toggle) — this
   * tracks whether the record exists on Meta at all. "draft" = Unpublished. */
  publishStatus: 'published' | 'draft'
}

// F22 — UI Skills API (docs/meta-api/ui-skills.md). `flow` component_type is
// intentionally excluded from this select (Flows out of scope, see F9 in
// AUDIT-TASKS.md). Unlike plain Skills, a UI skill carries no body/content —
// it's purely a routing rule telling the agent WHEN to send a given rich
// component; the component's own content lives elsewhere on Meta.
const COMPONENT_TYPES: { value: string; label: string }[] = [
  { value: 'carousel_quick_reply', label: 'Carousel (quick reply)' },
  { value: 'carousel_url', label: 'Carousel (URL)' },
  { value: 'cta_url', label: 'CTA button (URL)' },
  { value: 'image', label: 'Image' },
  { value: 'interactive_list', label: 'Interactive list' },
  { value: 'location', label: 'Location' },
  { value: 'location_request', label: 'Location request' },
]

export default function UiSkillEditorModal({
  agentId,
  skill,
  onClose,
}: {
  agentId: string
  skill: UiSkill | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(skill?.title ?? '')
  const [componentType, setComponentType] = useState(skill?.componentType ?? COMPONENT_TYPES[0].value)
  const [status, setStatus] = useState<'enabled' | 'disabled'>(skill?.status ?? 'disabled')
  const [instruction, setInstruction] = useState(skill?.instruction ?? '')
  const [error, setError] = useState<string | null>(null)

  const isEditing = skill !== null

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { title, componentType, status, instruction }
      return isEditing
        ? api.put(`/agents/${agentId}/ui-skills/${skill.id}`, payload)
        : api.post(`/agents/${agentId}/ui-skills`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ui-skills', agentId] })
      onClose()
    },
    onError: (err) => setError(extractErrorMessage(err)),
  })

  const inputCls =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

  return (
    <Modal
      title={isEditing ? 'Edit UI skill' : 'Add UI skill'}
      onClose={onClose}
      preventClose={mutation.isPending}
      maxWidthClassName="max-w-2xl"
    >
      <div className="flex flex-col">
        <div>
          {error && (
            <div className="mb-3">
              <ErrorBanner error={error} />
            </div>
          )}

          <p className="mb-4 text-xs text-muted-foreground">
            A UI skill tells the agent WHEN to send a rich WhatsApp component — carousel, CTA button,
            interactive list, or location request. It doesn't carry that component's content.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. order-status-carousel"
                className={inputCls}
              />
              <p className="text-xs text-muted-foreground text-right">{title.length}/64</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Component type</label>
              <select
                value={componentType}
                onChange={(e) => setComponentType(e.target.value)}
                className={inputCls}
              >
                {COMPONENT_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'enabled' | 'disabled')}
                className={inputCls}
              >
                <option value="disabled">Disabled</option>
                <option value="enabled">Enabled</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Instruction</label>
              <textarea
                rows={4}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Tell the agent WHEN to send this — e.g. 'Send when the customer asks to see order options'"
                className={cn(inputCls, 'resize-y')}
              />
              <p className="text-xs text-muted-foreground text-right">{instruction.length}/1024</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t shrink-0">
          <button
            onClick={() => { setError(null); mutation.mutate() }}
            disabled={mutation.isPending || !title.trim() || !instruction.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5
              text-sm font-semibold text-white transition-opacity hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Save changes' : 'Add UI skill'}
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
