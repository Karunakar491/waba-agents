import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import api from '../../lib/api'
import ErrorBanner from '../shared/ErrorBanner'
import { templateQueryKeys } from '../../lib/templateQueryKeys'
import { extractErrorMessage } from '../../lib/errors'
import TemplateListToolbar from './TemplateListToolbar'
import TemplateTable from './TemplateTable'
import { UnconfiguredEmpty, LibraryEmpty } from './TemplateListEmptyStates'
import { activeFilterCount, type TemplateFilters } from './TemplateFiltersPanel'
import {
  PAGE_SIZE,
  canEditStatus,
  extractTemplates,
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
  const [filters, setFilters] = useState<TemplateFilters>({ category: '', language: '', status: '' })
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
    queryKey: [...templateQueryKeys.list(wabaId), filters.status],
    queryFn: () => api.get(`/templates/${wabaId}`, { params: { status: filters.status } }).then((r) => r.data.data),
    enabled: configured && !!filters.status,
    ...listFreshness,
  })
  const listQuery = filters.status ? filteredQuery : allQuery

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
    return templatesRaw.filter((t) => {
      if (q && !(t.template_name || t.name || '').toLowerCase().includes(q)) return false
      if (filters.category && t.category !== filters.category) return false
      if (filters.language && t.language !== filters.language) return false
      return true
    })
  }, [templatesRaw, search, filters.category, filters.language])

  const pageCount = Math.max(1, Math.ceil(templates.length / PAGE_SIZE))
  const pagedTemplates = useMemo(
    () => templates.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [templates, page],
  )

  const hasAnyFilter = !!search.trim() || activeFilterCount(filters) > 0

  useEffect(() => { setPage(0) }, [search, filters, wabaId])

  function refetchLists() {
    allQuery.refetch()
    if (filters.status) filteredQuery.refetch()
  }

  return (
    <div className="space-y-4">
      <TemplateListToolbar
        configured={configured}
        search={search}
        filters={filters}
        allTemplates={templatesRaw}
        isFetching={listQuery.isFetching}
        onSearch={setSearch}
        onFiltersChange={setFilters}
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
            hasFilter={hasAnyFilter}
            onClearFilters={() => { setSearch(''); setFilters({ category: '', language: '', status: '' }) }}
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


