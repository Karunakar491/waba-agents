import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import api from '../lib/api'

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

function extractMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
  return data?.error ?? data?.message ?? 'Something went wrong. Please try again.'
}

// Merged into SkillLibraryPage as a tab (2026-08-05) — was a separate route
// with its own back-button/page-heading; now a self-contained tab body. Row
// list converted to a card grid: this is a browse-and-pick catalog job, not
// a comparison table, and a cramped single-line row undersold the "read the
// pitch, then act" job a template gallery needs (per the earlier UX audit).
export default function SkillTemplateBrowsePage() {
  const queryClient = useQueryClient()
  const [industry, setIndustry] = useState('')
  const [useCase, setUseCase] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

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

  const filtered = templates.filter(
    (t) => (!industry || t.industry === industry) && (!useCase || t.useCase === useCase),
  )

  const copyMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.post(`/skill-templates/${templateId}/copy`, { wabaId: waba!.id }),
    onMutate: () => setCopyError(null),
    onSuccess: (_res, templateId) => {
      setCopiedId(templateId)
      queryClient.invalidateQueries({ queryKey: ['library-skills', waba?.id] })
    },
    onError: (err) => setCopyError(extractMessage(err)),
  })

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Karix-curated reference skills, by industry and use case. Copy one to start your own — editing your copy never changes the original.
      </p>

      {copyError && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {copyError}
        </div>
      )}

      {!isLoading && templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip label="All industries" active={!industry} onClick={() => setIndustry('')} />
          {industries.map((i) => (
            <FilterChip key={i} label={i} active={industry === i} onClick={() => setIndustry(i)} />
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <FilterChip label="All use cases" active={!useCase} onClick={() => setUseCase('')} />
          {useCases.map((u) => (
            <FilterChip key={u} label={u} active={useCase === u} onClick={() => setUseCase(u)} />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-xl border bg-muted/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center">
          <p className="text-sm text-muted-foreground">No templates match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-all
                hover:shadow-md hover:border-primary/30"
            >
              <p className="text-sm font-semibold text-foreground">{template.title}</p>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground line-clamp-3">{template.description}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{template.industry}</span>
                <span>·</span>
                <span>{template.useCase}</span>
              </div>
              <button
                onClick={() => copyMutation.mutate(template.id)}
                disabled={!waba || copyMutation.isPending}
                title={!waba ? 'Connect a WABA first' : undefined}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold
                  text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {copyMutation.isPending && copyMutation.variables === template.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : copiedId === template.id ? (
                  <Check className="h-3.5 w-3.5 text-brand-green" />
                ) : null}
                {copiedId === template.id ? 'Copied' : 'Copy to my Skills'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-brand-pink text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
    >
      {label}
    </button>
  )
}
