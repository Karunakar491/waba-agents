import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2, Search, SlidersHorizontal } from 'lucide-react'
import api from '../lib/api'
import { cn } from '../lib/utils'
import { formatDateTimeIST } from '../lib/dateFormat'
import { useSelectedWaba } from '../hooks/useSelectedWaba'
import { redactSecrets } from '../components/templatestudio/auditRedaction'
import WabaPicker from '../components/templatestudio/WabaPicker'
import CopyButton from '../components/shared/CopyButton'
import ErrorBanner from '../components/shared/ErrorBanner'
import DebugFiltersPanel, { type DebugFilters, matchesFilters } from '../components/templatestudio/DebugFiltersPanel'

interface AuditEntry {
  id: string
  method: string
  path: string
  status_code: number | null
  request_body: string | null
  response_body: string | null
  error: string | null
  called_at: string
}

// Figma node 103:6 "3.9 — Template Studio: Debug" — raw API activity across
// WABAs, for troubleshooting. Real data: GET /templates/{wabaId}/audit-log
// (server-side redaction already happens in api_call_logger.py before rows
// are written; redactSecrets here is a second, client-side belt, per the
// existing pattern in TemplateSettingsPage's audit panel).
export default function TemplateDebugPage() {
  const { wabas, isLoading: wabasLoading, selectedWabaId, setSelectedWabaId } = useSelectedWaba()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<DebugFilters>({ method: '', statusBucket: '' })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filtersOpen) return
    function onClick(e: MouseEvent) {
      if (!filtersRef.current?.contains(e.target as Node)) setFiltersOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFiltersOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [filtersOpen])

  const logQuery = useQuery({
    queryKey: ['template-audit-log', selectedWabaId],
    queryFn: () =>
      api.get(`/templates/${selectedWabaId}/audit-log`, { params: { pathPrefix: '/api/templates' } })
        .then((r) => r.data.data),
    enabled: !!selectedWabaId,
  })

  const allEntries: AuditEntry[] = logQuery.data?.result ?? []
  const entries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allEntries.filter((e) => (!q || e.path.toLowerCase().includes(q)) && matchesFilters(e, filters))
  }, [allEntries, search, filters])

  const activeCount = (filters.method ? 1 : 0) + (filters.statusBucket ? 1 : 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Template Studio</span>
          <ChevronRight className="h-3 w-3" />
          <span>Debug</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Debug</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raw API activity across your WABAs — for troubleshooting, not day-to-day setup.
        </p>
      </div>

      {wabasLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <WabaPicker wabas={wabas} selectedWabaId={selectedWabaId} onChange={setSelectedWabaId} />
      )}

      {!selectedWabaId && (
        <p className="text-sm text-muted-foreground">Select a WABA to view its API activity.</p>
      )}

      {selectedWabaId && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-[320px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by path…"
                className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              />
            </div>
            <div ref={filtersRef} className="relative">
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={filtersOpen}
                className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeCount > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-teal-solid px-1 text-[11px] font-medium text-white">
                    {activeCount}
                  </span>
                )}
              </button>
              {filtersOpen && (
                <DebugFiltersPanel filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} />
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-surface-resting">
            {logQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {logQuery.isError && <ErrorBanner error={logQuery.error} />}
            {logQuery.data && entries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {allEntries.length === 0 ? 'No activity recorded yet.' : 'No entries match your search or filters.'}
              </p>
            )}
            <div className="divide-y">
              {entries.map((entry) => (
                <LogEntryRow
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function LogEntryRow({ entry, expanded, onToggle }: { entry: AuditEntry; expanded: boolean; onToggle: () => void }) {
  const ok = entry.status_code != null && entry.status_code < 400
  return (
    <div className="py-3">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ok ? 'bg-accent-teal' : 'bg-destructive')} />
          <span className="text-xs text-foreground">{entry.status_code ?? 'ERR'}</span>
          <span className="shrink-0 text-sm font-medium text-foreground">{entry.method}</span>
          <span className="truncate text-sm text-muted-foreground">{entry.path}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTimeIST(entry.called_at)}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {entry.error && <p className="text-xs text-destructive">Error: {redactSecrets(entry.error)}</p>}
          {entry.request_body && <JsonBlock label="REQUEST" body={redactSecrets(entry.request_body)} />}
          {entry.response_body && (
            <JsonBlock label={`RESPONSE ${entry.status_code ?? ''}`} body={redactSecrets(entry.response_body)} />
          )}
        </div>
      )}
    </div>
  )
}

function JsonBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
        <CopyButton value={body} size="sm" />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground">
        {body}
      </pre>
    </div>
  )
}
