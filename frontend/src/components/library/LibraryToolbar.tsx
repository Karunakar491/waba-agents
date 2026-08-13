import { Search } from 'lucide-react'

export interface LibrarySelectFilter {
  id: string
  /** Visible label, e.g. "Industry" — rendered as "Industry: All" when unset. */
  label: string
  value: string
  onChange: (value: string) => void
  /** Value/label pairs. An "All" option is prepended unless includeAll is false. */
  options: { value: string; label: string }[]
  /** False for closed sets with no "all" meaning — Sort, for example. */
  includeAll?: boolean
}

/**
 * Search box + the page's filter/sort selects, matching Figma 8.13/8.14/8.15's
 * SearchRow. Options are always passed in from what actually exists in the
 * data — DESIGN.md §9 forbids hardcoding an open-ended set (industries, use
 * cases) that the data may not contain.
 */
export default function LibraryToolbar({
  searchId,
  searchLabel,
  searchPlaceholder,
  search,
  onSearchChange,
  filters,
}: {
  searchId: string
  searchLabel: string
  searchPlaceholder: string
  search: string
  onSearchChange: (value: string) => void
  filters: LibrarySelectFilter[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-80 max-w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor={searchId} className="sr-only">{searchLabel}</label>
        <input
          id={searchId}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground"
        />
      </div>

      {filters.map((filter) => (
        <div key={filter.id}>
          <label htmlFor={filter.id} className="sr-only">{filter.label}</label>
          <select
            id={filter.id}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground"
          >
            {filter.includeAll !== false && <option value="ALL">{filter.label}: All</option>}
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {filter.label}: {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}
