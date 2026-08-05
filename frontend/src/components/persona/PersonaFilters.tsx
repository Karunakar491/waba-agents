import { Search } from 'lucide-react'
import { ProfileEditor } from '../agent-detail/BusinessProfileTab'
import type { BusinessProfileFormValues } from '../agent-detail/BusinessProfileTab'

export type StatusFilter = 'ALL' | 'DRAFT' | 'DEPLOYED' | 'ARCHIVED'

export function PersonaFilters({
  search, onSearchChange, statusFilter, onStatusFilterChange,
}: {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <label htmlFor="persona-search" className="sr-only">Search personas by description</label>
        <input
          id="persona-search"
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by description..."
          className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
        />
      </div>
      <label htmlFor="persona-status-filter" className="sr-only">Filter by status</label>
      <select
        id="persona-status-filter"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
        className="rounded-lg border bg-background px-3 py-2 text-sm
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
      >
        <option value="ALL">All statuses</option>
        <option value="DRAFT">Draft</option>
        <option value="DEPLOYED">Published</option>
        <option value="ARCHIVED">Saved (history)</option>
      </select>
    </div>
  )
}

export function PersonaDraftEditor({
  editingDraftId, form, formError, saving, onChange, onSave, onCancel,
}: {
  editingDraftId: string | null
  form: BusinessProfileFormValues
  formError: string | null
  saving: boolean
  onChange: (form: BusinessProfileFormValues) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-xl border bg-card shadow-surface-resting">
      <div className="px-4 py-3.5 border-b">
        <span className="text-sm font-semibold text-foreground">
          {editingDraftId ? 'Edit draft' : 'New draft'}
        </span>
      </div>
      <ProfileEditor
        form={form}
        formError={formError}
        saving={saving}
        isEditing={editingDraftId !== null}
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  )
}
