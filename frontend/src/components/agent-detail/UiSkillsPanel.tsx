import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, LayoutGrid } from 'lucide-react'
import api from '../../lib/api'
import UiSkillEditorModal, { type UiSkill } from './UiSkillEditorModal'
import StatusIndicator from '../shared/StatusIndicator'

const COMPONENT_LABELS: Record<string, string> = {
  carousel_quick_reply: 'Carousel (quick reply)',
  carousel_url: 'Carousel (URL)',
  cta_url: 'CTA button (URL)',
  image: 'Image',
  interactive_list: 'Interactive list',
  location: 'Location',
  location_request: 'Location request',
}

// F22 — messaging section of the Skills tab: UI Skills are a distinct Meta
// surface from the plain text-instruction Skills above (docs/meta-api/ui-skills.md).
// Founder-requested placement: alongside plain Skills, not a separate page.
export default function UiSkillsPanel({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient()
  const [editingSkill, setEditingSkill] = useState<UiSkill | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: skills = [], isLoading } = useQuery<UiSkill[]>({
    queryKey: ['ui-skills', agentId],
    queryFn: () => api.get(`/agents/${agentId}/ui-skills`).then((r) =>
      (r.data.data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id,
        title: s.title,
        componentType: s.componentType,
        status: s.status,
        instruction: s.instruction,
      })),
    ),
  })

  const deleteMutation = useMutation({
    mutationFn: (skillId: string) => api.delete(`/agents/${agentId}/ui-skills/${skillId}`),
    onMutate: (skillId) => setDeletingId(skillId),
    onSettled: () => setDeletingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ui-skills', agentId] }),
  })

  function openNew() {
    setEditingSkill(null)
    setShowEditor(true)
  }

  function openEdit(skill: UiSkill) {
    setEditingSkill(skill)
    setShowEditor(true)
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">UI Skills</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rich WhatsApp components — carousels, CTA buttons, interactive lists, location requests.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3 py-1.5 text-xs font-semibold
            text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add UI skill
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl border bg-muted/40 animate-pulse" />)}
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-14 text-center shadow-surface-resting">
          <LayoutGrid className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">No UI skills yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Tell the agent when to send a carousel, CTA button, interactive list, or location request.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-surface-resting"
            >
              <button onClick={() => openEdit(skill)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{skill.title}</p>
                  <StatusIndicator
                    label={skill.status === 'enabled' ? 'Enabled' : 'Disabled'}
                    tone={skill.status === 'enabled' ? 'positive' : 'neutral'}
                  />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {COMPONENT_LABELS[skill.componentType] ?? skill.componentType} — {skill.instruction}
                </p>
              </button>
              <button
                onClick={() => deleteMutation.mutate(skill.id)}
                disabled={deletingId === skill.id}
                aria-label={`Delete UI skill ${skill.title}`}
                className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                {deletingId === skill.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEditor && (
        <UiSkillEditorModal
          agentId={agentId}
          skill={editingSkill}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
