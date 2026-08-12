import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Library, Loader2, Plus, RefreshCw, Search, Trash2, Zap } from 'lucide-react'
import api from '../../lib/api'
import SkillEditorModal from './SkillEditorModal'
import UiSkillsPanel from './UiSkillsPanel'

interface AgentSkillView {
  id: string
  source: 'AGENT' | 'LIBRARY'
  title: string
  description: string
  body: string
  status: 'LIVE' | 'OUT_OF_SYNC'
  canPromote: boolean
  librarySkillId: string | null
}

interface SyncResult {
  attachmentId: string
  skillTitle: string
  success: boolean
  error: string | null
}

const STATUS_CONFIG = {
  LIVE: { label: 'Live', className: 'bg-brand-green/10 text-brand-green' },
  OUT_OF_SYNC: { label: 'Out of sync', className: 'bg-yellow-50 text-yellow-700' },
}

export default function SkillsTab({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient()
  const [editingSkill, setEditingSkill] = useState<AgentSkillView | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null)
  const [search, setSearch] = useState('')

  const { data: skills = [], isLoading } = useQuery<AgentSkillView[]>({
    queryKey: ['skills-view', agentId],
    queryFn: () => api.get(`/agents/${agentId}/skills-view`).then((r) => r.data.data ?? []),
  })

  const outOfSyncCount = skills.filter((s) => s.status === 'OUT_OF_SYNC').length

  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return skills
    return skills.filter(
      (s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    )
  }, [skills, search])

  const deleteMutation = useMutation({
    mutationFn: (skillId: string) => api.delete(`/agents/${agentId}/skills/${skillId}`),
    onMutate: (skillId) => setDeletingId(skillId),
    onSettled: () => setDeletingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills-view', agentId] }),
  })

  const promoteMutation = useMutation({
    mutationFn: (agentSkillId: string) => api.post(`/agents/${agentId}/skills/${agentSkillId}/promote`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills-view', agentId] }),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/agents/${agentId}/skills/sync`).then((r) => r.data.data.results as SyncResult[]),
    onSuccess: (results) => {
      setSyncResults(results)
      queryClient.invalidateQueries({ queryKey: ['skills-view', agentId] })
    },
  })

  function openNew() {
    setEditingSkill(null)
    setShowEditor(true)
  }

  function openEdit(skill: AgentSkillView) {
    setEditingSkill(skill)
    setShowEditor(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Skills</h3>
          {outOfSyncCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {outOfSyncCount} skill{outOfSyncCount === 1 ? '' : 's'} out of sync — sync to push the latest to WhatsApp.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {outOfSyncCount > 0 && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold
                text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {syncMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync skills
            </button>
          )}
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3 py-1.5 text-xs font-semibold
              text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add skill
          </button>
        </div>
      </div>

      {syncResults && (
        <div className="rounded-xl border bg-card px-4 py-3 shadow-surface-resting space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sync result</p>
            <button onClick={() => setSyncResults(null)} className="text-xs text-muted-foreground hover:text-foreground">
              Dismiss
            </button>
          </div>
          {syncResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing was out of sync.</p>
          ) : (
            syncResults.map((r) => (
              <p key={r.attachmentId} className={`text-sm ${r.success ? 'text-brand-green' : 'text-destructive'}`}>
                {r.skillTitle}: {r.success ? 'synced' : `failed — ${r.error}`}
              </p>
            ))
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl border bg-muted/40 animate-pulse" />)}
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-8 py-16 text-center shadow-surface-resting">
          <Zap className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-semibold text-foreground">No skills yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Define specific behaviors — like how to handle refunds or book appointments.
          </p>
        </div>
      ) : (
        <>
          {skills.length > 10 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills by title or description…"
                className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 text-sm
                  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
              />
            </div>
          )}
          {filteredSkills.length === 0 && (
            <div className="text-center py-6 space-y-1.5">
              <p className="text-sm text-muted-foreground">No skills match "{search}".</p>
              <button
                onClick={() => setSearch('')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        <ul className="space-y-2">
          {filteredSkills.map((skill) => {
            const statusCfg = STATUS_CONFIG[skill.status]
            return (
              <li
                key={skill.id}
                className="flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-surface-resting"
              >
                <button
                  onClick={() => openEdit(skill)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{skill.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {skill.canPromote && (
                    <button
                      onClick={() => promoteMutation.mutate(skill.id)}
                      disabled={promoteMutation.isPending}
                      title="Promote to Library — share this skill across agents on this WABA"
                      className="rounded p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {promoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Library className="h-4 w-4" />}
                    </button>
                  )}
                  {skill.source === 'AGENT' && (
                    <button
                      onClick={() => deleteMutation.mutate(skill.id)}
                      disabled={deletingId === skill.id}
                      aria-label={`Delete skill ${skill.title}`}
                      className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                      {deletingId === skill.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        </>
      )}

      {showEditor && (
        <SkillEditorModal
          agentId={agentId}
          skill={editingSkill}
          librarySkillId={editingSkill?.source === 'LIBRARY' ? editingSkill.librarySkillId ?? undefined : undefined}
          onClose={() => setShowEditor(false)}
        />
      )}

      <UiSkillsPanel agentId={agentId} />
    </div>
  )
}
