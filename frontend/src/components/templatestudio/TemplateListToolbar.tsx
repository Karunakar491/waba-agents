import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils'
import TemplateFiltersPanel, { activeFilterCount, type TemplateFilters } from './TemplateFiltersPanel'
import type { TemplateSummary } from './templateModel'

/**
 * Figma node 23:13/23:22 (V2 rebrand slice 3) — extracted from
 * TemplateListPanel.tsx to keep that file under the 200-line component
 * ceiling. "New template" (primary, teal) opens Iris; "Create manually"
 * (secondary) opens the existing TemplateBuilderForm flow — two distinct,
 * real destinations, not a relabel of one button.
 */
export default function TemplateListToolbar({
  configured, search, filters, allTemplates, isFetching,
  onSearch, onFiltersChange, onCreate, onBulk, onRefresh,
}: {
  configured: boolean
  search: string
  filters: TemplateFilters
  allTemplates: TemplateSummary[]
  isFetching: boolean
  onSearch: (v: string) => void
  onFiltersChange: (f: TemplateFilters) => void
  onCreate: () => void
  onBulk: () => void
  onRefresh: () => void
}) {
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)
  const activeCount = activeFilterCount(filters)

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

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!configured}
            onClick={onBulk}
            className="rounded-lg p-2 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bulk import
          </button>
          <button
            type="button"
            disabled={!configured}
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Create manually
          </button>
          <button
            type="button"
            disabled={!configured}
            onClick={() => navigate('/templates/iris')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium shadow-surface-resting transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              configured ? 'bg-accent-teal-solid text-white hover:opacity-90' : 'border bg-background text-foreground',
            )}
          >
            <Plus className="h-4 w-4" />
            New template
          </button>
        </div>
        <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">
          Opens Iris — it asks a few questions, then builds the template with you.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            disabled={!configured}
            placeholder="Search templates…"
            className="w-56 rounded-lg border bg-background py-2 pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2 disabled:opacity-50"
          />
        </div>

        <div ref={filtersRef} className="relative">
          <button
            type="button"
            disabled={!configured}
            onClick={() => setFiltersOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={filtersOpen}
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            <TemplateFiltersPanel
              templates={allTemplates}
              filters={filters}
              onChange={onFiltersChange}
              onClose={() => setFiltersOpen(false)}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={!configured}
          className="flex items-center gap-1 rounded-lg border px-2 py-2 text-xs text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>
    </div>
  )
}
