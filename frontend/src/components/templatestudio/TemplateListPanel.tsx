import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Pencil, RefreshCw, Settings as SettingsIcon, Search, Upload } from 'lucide-react'
import api from '../../lib/api'
import { cn } from '../../lib/utils'
import StatusIndicator from '../shared/StatusIndicator'
import ErrorBanner from '../shared/ErrorBanner'
import { templateQueryKeys } from '../../lib/templateQueryKeys'
import { extractErrorMessage } from '../../lib/errors'
import {
  PAGE_SIZE,
  TEMPLATE_STATUS_TONE,
  canEditStatus,
  classifyStatus,
  extractTemplates,
  qualityLabel,
  templateId,
  type TemplateSummary,
} from './templateModel'

export default function TemplateListPanel({
  wabaId,
  configured,
  configuredLoading,
  configuredError,
  onRetryConfigured,
  onCreate,
  onBulk,
  onEdit,
  editingFromUrl,
}: {
  wabaId: string
  configured: boolean
  configuredLoading: boolean
  configuredError?: unknown
  onRetryConfigured?: () => void
  onCreate: () => void
  onBulk: () => void
  onEdit: (t: TemplateSummary) => void
  editingFromUrl: string | null
}) {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  // Live Meta/Karix status on land + window focus; Refresh remains on-demand.
  const listFreshness = {
    staleTime: 0,
    refetchOnMount: 'always' as const,
    refetchOnWindowFocus: true,
  }
  const allQuery = useQuery({
    queryKey: [...templateQueryKeys.list(wabaId), 'all'],
    queryFn: () => api.get(`/templates/${wabaId}`).then((r) => r.data.data),
    enabled: configured,
    ...listFreshness,
  })
  const filteredQuery = useQuery({
    queryKey: [...templateQueryKeys.list(wabaId), statusFilter],
    queryFn: () => api.get(`/templates/${wabaId}`, { params: { status: statusFilter } }).then((r) => r.data.data),
    enabled: configured && !!statusFilter,
    ...listFreshness,
  })
  const listQuery = statusFilter ? filteredQuery : allQuery

  // Deep-link ?edit=<id> resolves from unfiltered allQuery (not the filtered table).
  useEffect(() => {
    if (!editingFromUrl || !allQuery.data) return
    const all = extractTemplates(allQuery.data)
    const found = all.find((t) => templateId(t) === editingFromUrl)
    if (found && canEditStatus(found.status)) onEdit(found)
  }, [editingFromUrl, allQuery.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const templatesRaw: TemplateSummary[] = configured ? extractTemplates(listQuery.data) : []
  const templates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return templatesRaw
    return templatesRaw.filter((t) => (t.template_name || t.name || '').toLowerCase().includes(q))
  }, [templatesRaw, search])

  const pageCount = Math.max(1, Math.ceil(templates.length / PAGE_SIZE))
  const pagedTemplates = useMemo(
    () => templates.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [templates, page],
  )

  useEffect(() => { setPage(0) }, [search, statusFilter, wabaId])

  function refetchLists() {
    allQuery.refetch()
    if (statusFilter) filteredQuery.refetch()
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        configured={configured}
        search={search}
        statusFilter={statusFilter}
        isFetching={listQuery.isFetching}
        onSearch={setSearch}
        onStatusFilter={setStatusFilter}
        onCreate={onCreate}
        onBulk={onBulk}
        onRefresh={refetchLists}
      />

      <div className="space-y-3 rounded-xl border bg-card p-5 shadow-surface-resting">
        {configuredLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!configured && !configuredLoading && configuredError && (
          <ErrorBanner
            error={`Could not check Karix configuration. ${extractErrorMessage(configuredError)}`}
            onRetry={onRetryConfigured}
          />
        )}
        {!configured && !configuredLoading && !configuredError && <UnconfiguredEmpty />}
        {configured && listQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {configured && listQuery.isError && (
          <ErrorBanner
            error={`Could not load templates. ${extractErrorMessage(listQuery.error)}`}
            onRetry={refetchLists}
          />
        )}
        {configured && listQuery.data && (listQuery.data as { ok?: boolean; error?: string }).ok === false && (
          <ErrorBanner
            error={(listQuery.data as { error?: string }).error || 'Could not load templates.'}
            onRetry={refetchLists}
          />
        )}

        {configured && templates.length === 0 && !listQuery.isLoading && !listQuery.isError
          && !(listQuery.data && (listQuery.data as { ok?: boolean }).ok === false) && (
          <LibraryEmpty
            hasFilter={!!(search.trim() || statusFilter)}
            onClearFilters={() => { setSearch(''); setStatusFilter('') }}
            onCreate={onCreate}
          />
        )}

        {configured && templates.length > 0 && (
          <TemplateTable
            rows={pagedTemplates}
            page={page}
            pageCount={pageCount}
            total={templates.length}
            onPage={setPage}
            onEdit={onEdit}
          />
        )}
      </div>
    </div>
  )
}

function ListToolbar({
  configured, search, statusFilter, isFetching,
  onSearch, onStatusFilter, onCreate, onBulk, onRefresh,
}: {
  configured: boolean
  search: string
  statusFilter: string
  isFetching: boolean
  onSearch: (v: string) => void
  onStatusFilter: (v: string) => void
  onCreate: () => void
  onBulk: () => void
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!configured}
          onClick={onCreate}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
            configured
              ? 'bg-brand-pink text-white hover:opacity-90'
              : 'border bg-background font-medium text-foreground',
          )}
        >
          <Plus className="h-4 w-4" />
          Create template
        </button>
        <button
          type="button"
          disabled={!configured}
          onClick={onBulk}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Bulk import
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            disabled={!configured}
            placeholder="Search by name"
            className="w-44 rounded-lg border bg-background py-1.5 pl-8 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 sm:w-56"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          disabled={!configured}
          className="rounded-lg border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <option value="">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
          <option value="PAUSED">Paused</option>
        </select>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!configured}
          className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>
    </div>
  )
}

function UnconfiguredEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center">
      <h3 className="text-sm font-semibold text-foreground">Karix not configured</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Map a Karix credential for this WABA in Settings before listing or creating templates.
      </p>
      <Link
        to="/templates/settings"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-pink px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <SettingsIcon className="h-4 w-4" />
        Go to Settings
      </Link>
    </div>
  )
}

function LibraryEmpty({
  hasFilter, onClearFilters, onCreate,
}: { hasFilter: boolean; onClearFilters: () => void; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center">
      {hasFilter ? (
        <>
          <h3 className="text-sm font-semibold text-foreground">No matching templates</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try a different name or status filter.</p>
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 inline-flex items-center rounded-lg border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Clear filters
          </button>
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-foreground">No templates yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create a template and submit it for Meta approval.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-pink px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create template
          </button>
        </>
      )}
    </div>
  )
}

function TemplateTable({
  rows, page, pageCount, total, onPage, onEdit,
}: {
  rows: TemplateSummary[]
  page: number
  pageCount: number
  total: number
  onPage: (updater: (p: number) => number) => void
  onEdit: (t: TemplateSummary) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3">Name</th>
            <th className="pb-2 pr-3">Category</th>
            <th className="pb-2 pr-3">Language</th>
            <th className="pb-2 pr-3">Quality</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2 text-right">Edit</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((t) => {
            const editable = canEditStatus(t.status)
            const pending = classifyStatus(t.status) === 'PENDING'
            return (
              <tr key={templateId(t)}>
                <td className="max-w-[240px] py-2.5 pr-3">
                  <p className="truncate font-medium text-foreground" title={t.template_name || t.name}>
                    {t.template_name || t.name}
                  </p>
                  {classifyStatus(t.status) === 'REJECTED' && (t.rejected_reason || t.reject_reason) && (
                    <p className="truncate text-xs text-destructive" title={t.rejected_reason || t.reject_reason}>
                      Rejected: {t.rejected_reason || t.reject_reason}
                    </p>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">{t.category ?? '—'}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{t.language ?? '—'}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{qualityLabel(t) ?? '—'}</td>
                <td className="py-2.5 pr-3">
                  <StatusIndicator
                    label={t.status || 'unknown'}
                    tone={TEMPLATE_STATUS_TONE[classifyStatus(t.status)]}
                  />
                </td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => editable && onEdit(t)}
                    className="rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={pending ? 'Edit unavailable while Pending' : 'Edit template'}
                    title={
                      pending
                        ? 'Meta is still reviewing this template — edit when Approved, Rejected, or Paused'
                        : editable
                          ? 'Edit template'
                          : 'Only Approved, Rejected, or Paused templates can be edited (Meta)'
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => onPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border px-2 py-1 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">Page {page + 1} of {pageCount}</span>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => onPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-lg border px-2 py-1 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
