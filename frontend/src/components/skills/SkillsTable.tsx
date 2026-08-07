import { FileText, Loader2, Trash2, Pencil } from 'lucide-react'
import StatusIndicator from '../shared/StatusIndicator'

export interface Deployment {
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
}

export interface SkillRow {
  id: string
  title: string
  description: string
  updatedAt: string
  deployed: boolean
  source: 'AGENT' | 'LIBRARY'
  deployments: Deployment[]
}

function statusBadge(row: SkillRow) {
  if (!row.deployed) {
    return <StatusIndicator label="Draft" tone="neutral" />
  }
  const count = row.deployments.length
  return <StatusIndicator label={`Deployed${count > 0 ? ` (${count})` : ''}`} tone="positive" />
}

// Founder-caught gap (2026-08-07): legacy "Imported agent (id)" names
// already contain the phone number id, so unconditionally appending it
// again rendered "Imported agent (123) (123)".
function deployedOn(row: SkillRow) {
  if (row.deployments.length === 0) return '—'
  return row.deployments
    .map((d) => {
      const name = d.agentName ?? 'Unknown agent'
      const alreadyShown = d.phoneNumberId != null && name.includes(d.phoneNumberId)
      return `${name}${d.phoneNumberId && !alreadyShown ? ` (${d.phoneNumberId})` : ''}`
    })
    .join(', ')
}

function SkillTableRow({
  row,
  deletingId,
  onEdit,
  onDelete,
}: {
  row: SkillRow
  deletingId: string | null
  onEdit: (row: SkillRow) => void
  onDelete: (row: SkillRow) => void
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 max-w-xs">
        <button onClick={() => onEdit(row)} className="text-left">
          <p className="text-sm font-medium text-foreground truncate">{row.title}</p>
          <p className="text-xs text-muted-foreground truncate">{row.description}</p>
        </button>
      </td>
      <td className="px-4 py-3">{statusBadge(row)}</td>
      <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{deployedOn(row)}</td>
      <td className="px-4 py-3 text-muted-foreground">{new Date(row.updatedAt).toLocaleString()}</td>
      <td className="px-4 py-3 text-right">
        {/* Founder-caught gap (2026-08-07): edit affordance existed but was
            an unlabeled icon, easy to miss. Explicit label + source-aware
            View/Edit distinction (a promoted LIBRARY skill is shared across
            agents on this WABA -- opening it is a view of the shared source,
            not a private edit; an AGENT-sourced skill is this agent's own,
            directly editable). */}
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(row)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            {row.source === 'LIBRARY' ? 'View' : 'Edit'}
          </button>
          <button
            onClick={() => onDelete(row)}
            disabled={deletingId === row.id}
            aria-label={`Delete skill ${row.title}`}
            className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </td>
    </tr>
  )
}

export function SkillsTable({
  isLoading,
  totalCount,
  rows,
  deletingId,
  onEdit,
  onDelete,
}: {
  isLoading: boolean
  totalCount: number
  rows: SkillRow[]
  deletingId: string | null
  onEdit: (row: SkillRow) => void
  onDelete: (row: SkillRow) => void
}) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {totalCount === 0
            ? "Your agents don't have any skills yet — browse the Skill Library for a starting template."
            : 'No skills match your search or filter.'}
        </p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs font-medium text-muted-foreground">
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Deployed on</th>
          <th className="px-4 py-3">Last edited</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <SkillTableRow key={row.id} row={row} deletingId={deletingId} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </tbody>
    </table>
  )
}
