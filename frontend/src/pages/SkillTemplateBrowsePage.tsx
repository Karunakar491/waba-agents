import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Eye, Search, BookOpen } from 'lucide-react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import ErrorBanner from '../components/shared/ErrorBanner'
import Modal from '../components/shared/Modal'

interface WabaEntry {
  id: string
}

interface SkillTemplate {
  id: string
  title: string
  description: string
  body: string
  industry: string
  useCase: string
}

// Founder-caught gap (2026-08-07): the chip-row filter read as a generic
// tag cloud, not a real library — no search, no result count, cards too
// cramped to read. Replaced with a proper filter bar (search + two
// dropdowns, matching the select pattern "My Skills" already uses) and a
// visible result count, same "library, not a chip soup" brief as the rest
// of tonight's audit round.
export default function SkillTemplateBrowsePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [useCase, setUseCase] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [viewingTemplate, setViewingTemplate] = useState<SkillTemplate | null>(null)

  const { data: wabas = [] } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  const { data: templates = [], isLoading } = useQuery<SkillTemplate[]>({
    queryKey: ['skill-templates'],
    queryFn: () => api.get('/skill-templates').then((r) => r.data.data ?? []),
  })

  const industries = useMemo(() => Array.from(new Set(templates.map((t) => t.industry))).sort(), [templates])
  const useCases = useMemo(() => Array.from(new Set(templates.map((t) => t.useCase))).sort(), [templates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates
      .filter((t) => !industry || t.industry === industry)
      .filter((t) => !useCase || t.useCase === useCase)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
  }, [templates, search, industry, useCase])

  const copyMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.post(`/skill-templates/${templateId}/copy`, { wabaId: waba!.id }),
    onMutate: () => setCopyError(null),
    onSuccess: (_res, templateId) => {
      setCopiedId(templateId)
      queryClient.invalidateQueries({ queryKey: ['library-skills', waba?.id] })
    },
    onError: (err) => setCopyError(extractErrorMessage(err)),
  })

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Karix-curated reference skills, by industry and use case. Copy one to start your own — editing your copy never changes the original.
      </p>

      {copyError && (
        <div className="mt-3">
          <ErrorBanner error={copyError} />
        </div>
      )}

      {!isLoading && templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
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
          <label htmlFor="template-industry-filter" className="sr-only">Filter by industry</label>
          <select
            id="template-industry-filter"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">All industries</option>
            {industries.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <label htmlFor="template-usecase-filter" className="sr-only">Filter by use case</label>
          <select
            id="template-usecase-filter"
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">All use cases</option>
            {useCases.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground shrink-0">
            {filtered.length} of {templates.length} skill{templates.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-xl border bg-muted/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No templates match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="flex flex-col rounded-xl border bg-card p-5 shadow-surface-resting transition-all
                hover:shadow-surface-lifted hover:border-primary/30"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {template.useCase}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{template.title}</p>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground line-clamp-5">{template.description}</p>
              <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                {template.industry}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setViewingTemplate(template)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs
                    font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
                <button
                  onClick={() => copyMutation.mutate(template.id)}
                  disabled={!waba || copyMutation.isPending}
                  title={!waba ? 'Connect a WABA first' : undefined}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold
                    text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copyMutation.isPending && copyMutation.variables === template.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : copiedId === template.id ? (
                    <Check className="h-3.5 w-3.5 text-brand-green" />
                  ) : null}
                  {copiedId === template.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingTemplate && (
        <Modal
          title={viewingTemplate.title}
          onClose={() => setViewingTemplate(null)}
          maxWidthClassName="max-w-lg"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">{viewingTemplate.industry}</span>
            <span className="rounded-full bg-muted px-2 py-0.5">{viewingTemplate.useCase}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{viewingTemplate.description}</p>
          <div className="mt-4 space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Skill instructions</label>
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs text-foreground">
              {viewingTemplate.body}
            </pre>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                copyMutation.mutate(viewingTemplate.id)
                setViewingTemplate(null)
              }}
              disabled={!waba || copyMutation.isPending}
              title={!waba ? 'Connect a WABA first' : undefined}
              className="flex items-center gap-1.5 rounded-lg bg-brand-pink px-3.5 py-2 text-sm font-semibold
                text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Copy to my Skills
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
