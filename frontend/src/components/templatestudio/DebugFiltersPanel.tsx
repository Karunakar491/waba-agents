import { cn } from '../../lib/utils'

const METHODS = ['GET', 'POST', 'PUT', 'DELETE']
const STATUS_BUCKETS = [
  { value: '2xx', label: 'Success (2xx)' },
  { value: '4xx', label: 'Client error (4xx)' },
  { value: '5xx', label: 'Server error (5xx)' },
] as const

export interface DebugFilters {
  method: string
  statusBucket: '' | '2xx' | '4xx' | '5xx'
}

export function matchesFilters(
  entry: { method: string; status_code: number | null },
  filters: DebugFilters,
): boolean {
  if (filters.method && entry.method !== filters.method) return false
  if (filters.statusBucket) {
    const code = entry.status_code ?? 0
    const bucket = code >= 500 ? '5xx' : code >= 400 ? '4xx' : code >= 200 ? '2xx' : ''
    if (bucket !== filters.statusBucket) return false
  }
  return true
}

// Figma node 105:11 — Method + Status pill groups, per DESIGN.md §6 Filters
// pattern (one panel, grouped sections, small fixed enums as pills).
export default function DebugFiltersPanel({
  filters, onChange, onClose,
}: {
  filters: DebugFilters
  onChange: (f: DebugFilters) => void
  onClose: () => void
}) {
  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-80 space-y-4 rounded-xl border border-border bg-card px-4 pb-3 pt-4 shadow-surface-lifted">
      <div className="space-y-2">
        <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">METHOD</p>
        <div className="flex flex-wrap gap-2">
          <Pill selected={!filters.method} onClick={() => onChange({ ...filters, method: '' })}>All</Pill>
          {METHODS.map((m) => (
            <Pill key={m} selected={filters.method === m} onClick={() => onChange({ ...filters, method: m })}>
              {m}
            </Pill>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">STATUS</p>
        <div className="flex flex-wrap gap-2">
          <Pill selected={!filters.statusBucket} onClick={() => onChange({ ...filters, statusBucket: '' })}>All</Pill>
          {STATUS_BUCKETS.map((s) => (
            <Pill
              key={s.value}
              selected={filters.statusBucket === s.value}
              onClick={() => onChange({ ...filters, statusBucket: s.value })}
            >
              {s.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={() => onChange({ method: '', statusBucket: '' })}
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

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
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
