import { useQueries } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import api from '../../lib/api'
import StatusIndicator from '../shared/StatusIndicator'
import { templateQueryKeys } from '../../lib/templateQueryKeys'
import type { WabaEntry } from '../../hooks/useSelectedWaba'
import {
  classifyStatus,
  extractTemplates,
  qualityLabel,
  type TemplateSummary,
} from './templateModel'

const MAX_WABAS = 5

function tally(templates: TemplateSummary[]) {
  let pending = 0
  let rejected = 0
  let lowQuality = 0
  for (const t of templates) {
    const status = classifyStatus(t.status)
    if (status === 'PENDING') pending += 1
    if (status === 'REJECTED') rejected += 1
    const q = (qualityLabel(t) || '').toLowerCase()
    if (q.includes('low') || q === 'red') lowQuality += 1
  }
  return { pending, rejected, lowQuality }
}

/**
 * Cross-WABA health glance (A− fleet signal) — Pending / Rejected / Low quality
 * across up to 5 configured WABAs via existing list APIs. Fail-soft.
 */
export default function CrossWabaHealthStrip({
  wabas,
  onSelectWaba,
}: {
  wabas: WabaEntry[]
  onSelectWaba: (id: string) => void
}) {
  const scoped = wabas.slice(0, MAX_WABAS)
  const overflow = Math.max(0, wabas.length - MAX_WABAS)

  const credQueries = useQueries({
    queries: scoped.map((w) => ({
      queryKey: ['phone-mappings', w.id],
      queryFn: () => api.get(`/templates/${w.id}/phone-mappings`).then((r) => r.data.data as unknown[]),
      staleTime: 30_000,
    })),
  })

  const configuredIds = scoped
    .filter((_, i) => (credQueries[i]?.data?.length ?? 0) > 0)
    .map((w) => w.id)

  const listQueries = useQueries({
    queries: configuredIds.map((id) => ({
      queryKey: [...templateQueryKeys.list(id), 'all', 'health'],
      queryFn: () => api.get(`/templates/${id}`).then((r) => r.data.data),
      staleTime: 0,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: true,
    })),
  })

  const credLoading = credQueries.some((q) => q.isLoading)
  const listLoading = listQueries.some((q) => q.isLoading)

  // Per-WABA breakdown for click-to-focus; totals for the strip.
  const rows = configuredIds.map((id, i) => {
    const waba = scoped.find((w) => w.id === id)!
    const data = listQueries[i]?.data
    const ok = data && (data as { ok?: boolean }).ok !== false
    const templates = ok ? extractTemplates(data) : []
    return { waba, ...tally(templates), failed: listQueries[i]?.isError || (data && (data as { ok?: boolean }).ok === false) }
  })

  const totals = rows.reduce(
    (acc, r) => ({
      pending: acc.pending + r.pending,
      rejected: acc.rejected + r.rejected,
      lowQuality: acc.lowQuality + r.lowQuality,
    }),
    { pending: 0, rejected: 0, lowQuality: 0 },
  )

  const anyConfigured = configuredIds.length > 0
  const hottest = rows
    .filter((r) => !r.failed && (r.pending + r.rejected + r.lowQuality) > 0)
    .sort((a, b) => (b.pending + b.rejected + b.lowQuality) - (a.pending + a.rejected + a.lowQuality))[0]

  // Don't render an empty strip when nothing is mapped yet.
  const show = wabas.length > 0 && (credLoading || listLoading || anyConfigured)
  if (!show) return null

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-surface-resting">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Across your WABAs
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pending · Rejected · Low quality — from live Karix lists
            {overflow > 0 ? ` (first ${MAX_WABAS}; +${overflow} not scanned)` : ''}
          </p>
        </div>
        {(credLoading || listLoading) && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {!credLoading && !anyConfigured && (
        <p className="mt-2 text-sm text-muted-foreground">
          No Karix-mapped WABAs yet — health appears after Settings mapping.
        </p>
      )}

      {anyConfigured && !listLoading && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <StatusIndicator label={`Pending ${totals.pending}`} tone={totals.pending > 0 ? 'warning' : 'neutral'} />
          <StatusIndicator label={`Rejected ${totals.rejected}`} tone={totals.rejected > 0 ? 'negative' : 'neutral'} />
          <StatusIndicator label={`Low quality ${totals.lowQuality}`} tone={totals.lowQuality > 0 ? 'warning' : 'neutral'} />
          {hottest && (
            <button
              type="button"
              onClick={() => onSelectWaba(hottest.waba.id)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Focus {hottest.waba.label || hottest.waba.wabaId} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
