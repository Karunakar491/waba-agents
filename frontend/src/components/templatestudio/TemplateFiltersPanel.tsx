import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import type { TemplateSummary } from './templateModel'

const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
]

const STATUSES = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PAUSED', label: 'Paused' },
]

export interface TemplateFilters {
  category: string
  language: string
  status: string
}

export function activeFilterCount(f: TemplateFilters): number {
  return [f.category, f.language, f.status].filter(Boolean).length
}

/**
 * DESIGN.md §6 Filters pattern — one panel, grouped sections, never scattered
 * dropdowns. Category/Status are Meta's real small fixed enums (pill rows);
 * Language is genuinely open-ended, so it gets a search + dynamic checklist
 * scoped to what this account's templates actually use (§9's "hardcoded
 * lists for open-ended data" anti-pattern) instead of a hardcoded list.
 */
export default function TemplateFiltersPanel({
  templates,
  filters,
  onChange,
  onClose,
}: {
  templates: TemplateSummary[]
  filters: TemplateFilters
  onChange: (next: TemplateFilters) => void
  onClose: () => void
}) {
  const [langSearch, setLangSearch] = useState('')

  const languages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of templates) {
      if (!t.language) continue
      counts.set(t.language, (counts.get(t.language) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([lang]) => lang.toLowerCase().includes(langSearch.trim().toLowerCase()))
  }, [templates, langSearch])

  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-80 space-y-4 rounded-xl border border-border bg-card px-4 pb-3 pt-4 shadow-surface-lifted">
      <PillGroup
        label="Category"
        options={CATEGORIES}
        value={filters.category}
        onChange={(category) => onChange({ ...filters, category })}
      />

      <div className="space-y-2">
        <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">LANGUAGE</p>
        <input
          type="text"
          value={langSearch}
          onChange={(e) => setLangSearch(e.target.value)}
          placeholder="Search languages…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
        />
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {languages.length === 0 && (
            <p className="p-1 text-xs text-muted-foreground">No languages match.</p>
          )}
          {languages.map(([lang, count]) => (
            <button
              key={lang}
              type="button"
              onClick={() => onChange({ ...filters, language: filters.language === lang ? '' : lang })}
              className="flex w-full items-center justify-between rounded-lg p-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 rounded border border-border',
                    filters.language === lang && 'border-transparent bg-accent-teal',
                  )}
                />
                <span className="text-sm font-medium text-foreground">{lang}</span>
              </span>
              <span className="text-xs text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Only languages used in this account's templates are shown.
        </p>
      </div>

      <PillGroup
        label="Status"
        options={STATUSES}
        value={filters.status}
        onChange={(status) => onChange({ ...filters, status })}
      />

      <div className="flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={() => onChange({ category: '', language: '', status: '' })}
          className="rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function PillGroup({
  label, options, value, onChange,
}: {
  label: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">{label.toUpperCase()}</p>
      <div className="flex flex-wrap gap-2">
        <Pill selected={!value} onClick={() => onChange('')}>All</Pill>
        {options.map((o) => (
          <Pill key={o.value} selected={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </Pill>
        ))}
      </div>
    </div>
  )
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid',
        selected
          ? 'border-border bg-muted font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}
