import { Link, useNavigate } from 'react-router-dom'
import { Plus, Settings as SettingsIcon } from 'lucide-react'

// Extracted from TemplateListPanel.tsx (V2 rebrand slice 3); restyled to
// DESIGN.md's asymmetric empty-state pattern in slice 4 (Figma node 39:421)
// — left accent bar, left-aligned copy, a real primary CTA. The
// filtered-zero-results case (hasFilter=true) is a different situation
// (narrowed a real list to nothing, not "nothing exists yet") so it keeps
// the simpler centered message + Clear filters, not the accent-bar pattern.

export function UnconfiguredEmpty() {
  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card px-8 py-10">
      <div className="h-[72px] w-[3px] shrink-0 bg-warning" />
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">Karix isn't connected for this WABA yet</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Map a Karix credential in Settings before listing or creating templates.
        </p>
        <Link
          to="/templates/settings"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          <SettingsIcon className="h-4 w-4" />
          Go to Settings
        </Link>
      </div>
    </div>
  )
}

export function LibraryEmpty({
  hasFilter, onClearFilters, onCreate,
}: { hasFilter: boolean; onClearFilters: () => void; onCreate: () => void }) {
  const navigate = useNavigate()

  if (hasFilter) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center">
        <h3 className="text-sm font-semibold text-foreground">No matching templates</h3>
        <p className="mt-1 text-sm text-muted-foreground">Try a different name, category, language, or status filter.</p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 inline-flex items-center rounded-lg border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          Clear filters
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card px-8 py-10">
      <div className="h-[72px] w-[3px] shrink-0 bg-accent-teal" />
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">No templates yet for this account</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Iris can build your first one from a short description, or start from a blank form.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/templates/iris')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium text-white shadow-surface-resting transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            New template
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            Create manually
          </button>
        </div>
      </div>
    </div>
  )
}
