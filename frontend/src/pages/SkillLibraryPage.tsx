import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Search, Zap } from 'lucide-react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import SkillEditorModal from '../components/agent-detail/SkillEditorModal'
import { SkillsTable, type SkillRow } from '../components/skills/SkillsTable'
import SkillTemplateBrowsePage from './SkillTemplateBrowsePage'
import { cn } from '../lib/utils'
import ErrorBanner from '../components/shared/ErrorBanner'
import ConfirmDeleteModal from '../components/shared/ConfirmDeleteModal'

type SkillTab = 'mine' | 'browse'

interface WabaEntry {
  id: string
  wabaId: string
  label: string | null
  status: string
}

interface LibrarySkill extends SkillRow {
  body: string
  wabaId: string | null
  agentId: string | null
  agentName: string | null
}

export default function SkillLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: SkillTab = searchParams.get('tab') === 'browse' ? 'browse' : 'mine'
  const queryClient = useQueryClient()
  const [editingSkill, setEditingSkill] = useState<LibrarySkill | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LibrarySkill | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'deployed' | 'draft'>('all')

  // Multi-WABA switcher deferred (TASKS.md follow-up) — default to the first
  // WABA this account has access to, same resolution order used elsewhere
  // in the account/WABA-decoupled model.
  const { data: wabas = [], isLoading: wabasLoading } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  const { data: skills = [], isLoading: skillsLoading } = useQuery<LibrarySkill[]>({
    queryKey: ['library-skills', waba?.id],
    queryFn: () => api.get('/skills', { params: { wabaId: waba!.id } }).then((r) => r.data.data ?? []),
    enabled: !!waba,
  })

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return skills
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .filter((s) => statusFilter === 'all' || (statusFilter === 'deployed' ? s.deployed : !s.deployed))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [skills, search, statusFilter])

  const deleteMutation = useMutation({
    mutationFn: (skill: LibrarySkill) =>
      skill.source === 'AGENT'
        ? api.delete(`/agents/${skill.agentId}/skills/${skill.id}`)
        : api.delete(`/skills/${skill.id}`),
    onMutate: (skill) => { setDeletingId(skill.id); setDeleteError(null) },
    onSettled: () => setDeletingId(null),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['library-skills', waba?.id] }); setPendingDelete(null) },
    // Deleting a Library skill still attached to an agent 400s (fk_attachment_skill,
    // TASK-050) — the primary expected failure here, not an edge case, since
    // the whole point of a Library skill is to be attached to multiple agents.
    // Shown inline in the confirm modal (not close-then-toast) so the user
    // isn't left wondering whether the delete went through.
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  })

  function openEdit(row: SkillRow) {
    const skill = skills.find((s) => s.id === row.id)
    if (skill) { setEditingSkill(skill); setShowEditor(true) }
  }

  const isLoading = wabasLoading || skillsLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {waba ? `Every skill live on any agent on ${waba.label ?? waba.wabaId}, plus shared drafts.` : 'Every skill your agents have, in one place.'}
        </p>
      </div>

      {/* My Skills / Browse Templates tabs (2026-08-05 merge) — was two
          separate routes with a back-link between them; now one page, one
          mental context. */}
      <div className="flex gap-4 border-b">
        {(['mine', 'browse'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSearchParams(tab === 'mine' ? {} : { tab: 'browse' })}
            className={cn(
              'pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'mine' ? 'My Skills' : 'Browse Templates'}
          </button>
        ))}
      </div>

      {activeTab === 'browse' ? (
        <SkillTemplateBrowsePage />
      ) : (
        <>
          {deleteError && (
            <div className="mt-3">
              <ErrorBanner error={deleteError} />
            </div>
          )}

          {!isLoading && !waba ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center">
              <Zap className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-semibold text-foreground">No WABA connected yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Connect a WABA to see your agents' skills here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
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
                <label htmlFor="skill-status-filter" className="sr-only">Filter by status</label>
                <select
                  id="skill-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="rounded-lg border bg-background px-3 py-2.5 text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="deployed">Deployed</option>
                  <option value="draft">Draft</option>
                </select>
                <p className="text-xs text-muted-foreground shrink-0">
                  Add new shared skills via Promote (agent Skills tab) or the Browse Templates tab.
                </p>
              </div>

              <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden overflow-x-auto">
                <SkillsTable
                  isLoading={isLoading}
                  totalCount={skills.length}
                  rows={filteredRows}
                  deletingId={deletingId}
                  onEdit={openEdit}
                  onDelete={(row) => {
                    const skill = skills.find((s) => s.id === row.id)
                    if (skill) { setDeleteError(null); setPendingDelete(skill) }
                  }}
                />
              </div>
            </>
          )}
        </>
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          title="Delete skill"
          consequence={
            <>
              Delete <strong className="font-semibold text-foreground">{pendingDelete.title}</strong>? Your
              agent{pendingDelete.deployments.length > 1 ? 's' : ''} will no longer use it in conversations. This
              cannot be undone.
            </>
          }
          confirmLabel="Delete skill"
          isPending={deletingId === pendingDelete.id}
          error={deleteError}
          onConfirm={() => deleteMutation.mutate(pendingDelete)}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {showEditor && editingSkill && waba && (
        <SkillEditorModal
          agentId={editingSkill.source === 'AGENT' ? editingSkill.agentId ?? '' : ''}
          skill={editingSkill}
          librarySkillId={editingSkill.source === 'LIBRARY' ? editingSkill.id : undefined}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
