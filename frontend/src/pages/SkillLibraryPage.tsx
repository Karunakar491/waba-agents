import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Trash2, Zap } from 'lucide-react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import { type SkillRow } from '../components/skills/skillTypes'
import LibraryTable, { LibraryTableSkeleton } from '../components/library/LibraryTable'
import LibraryToolbar from '../components/library/LibraryToolbar'
import { UiSkillsLibraryTable, type UiSkillRow } from '../components/skills/UiSkillsLibraryTable'
import SkillTemplateBrowsePage from './SkillTemplateBrowsePage'
import { cn } from '../lib/utils'
import ErrorBanner from '../components/shared/ErrorBanner'
import ConfirmDeleteModal from '../components/shared/ConfirmDeleteModal'
import { useActionFeedback } from '../components/shared/ActionFeedback'

type SkillTab = 'mine' | 'ui-skills' | 'browse'

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
  // V43 — real provenance tags, carried across from skill_template on copy.
  // Null on every skill created before V43 and on every legacy AGENT row.
  industry: string | null
  useCase: string | null
}

type SkillSort = 'most-used' | 'recent'

function uniqueSorted(values: (string | null)[]): { value: string; label: string }[] {
  return Array.from(new Set(values.filter((v): v is string => !!v)))
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }))
}

export default function SkillLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const tabParam = searchParams.get('tab')
  const activeTab: SkillTab = tabParam === 'browse' ? 'browse' : tabParam === 'ui-skills' ? 'ui-skills' : 'mine'
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { confirm } = useActionFeedback()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LibrarySkill | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [industryFilter, setIndustryFilter] = useState('ALL')
  const [useCaseFilter, setUseCaseFilter] = useState('ALL')
  const [sort, setSort] = useState<SkillSort>('most-used')

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

  const { data: uiSkills = [], isLoading: uiSkillsLoading } = useQuery<UiSkillRow[]>({
    queryKey: ['library-ui-skills', waba?.id],
    queryFn: () => api.get('/ui-skills', { params: { wabaId: waba!.id } }).then((r) => r.data.data ?? []),
    enabled: !!waba && activeTab === 'ui-skills',
  })

  const industryOptions = useMemo(() => uniqueSorted(skills.map((s) => s.industry)), [skills])
  const useCaseOptions = useMemo(() => uniqueSorted(skills.map((s) => s.useCase)), [skills])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return skills
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .filter((s) => statusFilter === 'ALL' || (statusFilter === 'deployed' ? s.deployed : !s.deployed))
      .filter((s) => industryFilter === 'ALL' || s.industry === industryFilter)
      .filter((s) => useCaseFilter === 'ALL' || s.useCase === useCaseFilter)
      .sort((a, b) =>
        sort === 'most-used'
          ? b.deployments.length - a.deployments.length
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
  }, [skills, search, statusFilter, industryFilter, useCaseFilter, sort])

  /**
   * How many skills share each (agent, title) pair.
   *
   * Meta permits two skills on one agent with the same title, and one agent on
   * this account has ten separate rules all called `intent-router` — different
   * bodies, same name. The table showed them as ten identical rows, which read
   * as duplicated data and made deleting the wrong rule easy. Counted over all
   * skills rather than the filtered view, so a search does not make the warning
   * disappear while the ambiguity remains.
   */
  const sameNameCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of skills) {
      const k = `${s.agentId ?? 'library'}||${s.title}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return counts
  }, [skills])

  const deleteMutation = useMutation({
    mutationFn: (skill: LibrarySkill) =>
      skill.source === 'AGENT'
        ? api.delete(`/agents/${skill.agentId}/skills/${skill.id}`)
        : api.delete(`/skills/${skill.id}`),
    onMutate: (skill) => { setDeletingId(skill.id); setDeleteError(null) },
    onSettled: () => setDeletingId(null),
    onSuccess: (_data, skill) => {
      queryClient.invalidateQueries({ queryKey: ['library-skills', waba?.id] })
      setPendingDelete(null)
      confirm('Skill deleted', skill.title)
    },
    // Deleting a Library skill still attached to an agent 400s (fk_attachment_skill,
    // TASK-050) — the primary expected failure here, not an edge case, since
    // the whole point of a Library skill is to be attached to multiple agents.
    // Shown inline in the confirm modal (not close-then-toast) so the user
    // isn't left wondering whether the delete went through.
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  })

  function openEdit(row: SkillRow) {
    navigate(`/library/skills/${row.id}/edit`)
  }

  const isLoading = wabasLoading || skillsLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Skills Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable rules pulled from every agent on your account
          {waba ? ` on ${waba.label ?? waba.wabaId}` : ''}.
        </p>
      </div>

      {/* My Skills / Browse Templates tabs (2026-08-05 merge) — was two
          separate routes with a back-link between them; now one page, one
          mental context. */}
      <div className="flex gap-4 border-b">
        {(['mine', 'ui-skills', 'browse'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSearchParams(tab === 'mine' ? {} : { tab })}
            className={cn(
              'pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'mine' ? 'My Skills' : tab === 'ui-skills' ? 'UI Skills' : 'Browse Templates'}
          </button>
        ))}
      </div>

      {activeTab === 'browse' ? (
        <SkillTemplateBrowsePage />
      ) : activeTab === 'ui-skills' ? (
        <>
          {!waba ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center">
              <Zap className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-semibold text-foreground">No WABA connected yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Connect a WABA to see your agents' UI skills here.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Every rich-message skill (carousel, CTA, interactive list, location) across every agent on{' '}
                {waba.label ?? waba.wabaId}. Edit on the owning agent's Skills tab.
              </p>
              <div className="mt-4 rounded-xl border bg-card shadow-surface-resting overflow-hidden overflow-x-auto">
                <UiSkillsLibraryTable isLoading={uiSkillsLoading} rows={uiSkills} />
              </div>
            </>
          )}
        </>
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
              <LibraryToolbar
                searchId="skill-search"
                searchLabel="Search skills by title or description"
                searchPlaceholder="Search skills…"
                search={search}
                onSearchChange={setSearch}
                filters={[
                  ...(industryOptions.length > 0
                    ? [{ id: 'skill-industry-filter', label: 'Industry', value: industryFilter, onChange: setIndustryFilter, options: industryOptions }]
                    : []),
                  ...(useCaseOptions.length > 0
                    ? [{ id: 'skill-use-case-filter', label: 'Use case', value: useCaseFilter, onChange: setUseCaseFilter, options: useCaseOptions }]
                    : []),
                  {
                    id: 'skill-sort',
                    label: 'Sort',
                    value: sort,
                    onChange: (v: string) => setSort(v as SkillSort),
                    includeAll: false,
                    options: [
                      { value: 'most-used', label: 'Most used' },
                      { value: 'recent', label: 'Recently edited' },
                    ],
                  },
                  {
                    id: 'skill-status-filter',
                    label: 'Status',
                    value: statusFilter,
                    onChange: setStatusFilter,
                    options: [
                      { value: 'deployed', label: 'Published' },
                      { value: 'draft', label: 'Draft' },
                    ],
                  },
                ]}
              />

              {isLoading ? (
                <LibraryTableSkeleton />
              ) : filteredRows.length === 0 ? (
                <div className="rounded-xl border border-l-4 border-l-accent-teal-solid bg-card p-6 shadow-surface-resting">
                  <p className="text-base font-semibold text-foreground">
                    {skills.length === 0 ? 'No shared skills yet' : 'Nothing matches those filters'}
                  </p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {skills.length === 0
                      ? 'Skills arrive here two ways: promote one from an agent’s Skills tab, or start from a ready-made rule in Browse Templates.'
                      : 'Clear a filter or search for a different word to see the rest of your skills.'}
                  </p>
                  {skills.length === 0 && (
                    <button
                      onClick={() => setSearchParams({ tab: 'browse' })}
                      className="mt-4 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      Browse templates
                    </button>
                  )}
                </div>
              ) : (
                <LibraryTable
                  itemLabel="Skill"
                  // Without this the list is unusable: the same skill appears
                  // once per agent, and on the live account `intent-router`
                  // showed nine times with every row reading "Published, 1
                  // agent" and nothing to tell them apart. Deleting the wrong
                  // one is a live change to a real customer's agent.
                  ownerLabel="On agent"
                  rows={filteredRows.map((skill) => ({
                    id: skill.id,
                    name: skill.title,
                    detail: skill.description,
                    owner: skill.agentName,
                    nameNote: (() => {
                      const n = sameNameCounts.get(`${skill.agentId ?? 'library'}||${skill.title}`) ?? 1
                      return n > 1
                        ? `${n} different rules on this agent share this name — open it to see which this is`
                        : null
                    })(),
                    tags: [skill.industry, skill.useCase].filter((t): t is string => !!t),
                    statusLabel: skill.deployed ? 'Published' : 'Draft',
                    statusTone: skill.deployed ? ('positive' as const) : ('neutral' as const),
                    usedByCount: skill.deployments.length,
                    updatedAt: skill.updatedAt ?? null,
                    onOpen: () => openEdit(skill),
                    actions: (
                      <>
                        <button
                          onClick={() => openEdit(skill)}
                          className="min-h-11 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {skill.source === 'LIBRARY' ? 'View' : 'Edit'}
                        </button>
                        <button
                          onClick={() => { setDeleteError(null); setPendingDelete(skill) }}
                          disabled={deletingId === skill.id}
                          aria-label={`Delete skill ${skill.title}`}
                          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                        >
                          {deletingId === skill.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </>
                    ),
                  }))}
                />
              )}
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

    </div>
  )
}
