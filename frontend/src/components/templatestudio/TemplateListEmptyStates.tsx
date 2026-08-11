import { Link } from 'react-router-dom'
import { Plus, Settings as SettingsIcon } from 'lucide-react'

// Extracted from TemplateListPanel.tsx (V2 rebrand slice 3) to keep that
// file under the 200-line component ceiling.

export function UnconfiguredEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center">
      <h3 className="text-sm font-semibold text-foreground">Karix not configured</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Map a Karix credential for this WABA in Settings before listing or creating templates.
      </p>
      <Link
        to="/templates/settings"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <SettingsIcon className="h-4 w-4" />
        Go to Settings
      </Link>
    </div>
  )
}

export function LibraryEmpty({
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
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create template
          </button>
        </>
      )}
    </div>
  )
}
