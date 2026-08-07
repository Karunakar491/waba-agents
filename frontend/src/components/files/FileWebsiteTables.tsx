import { FileText, Globe, Loader2, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusIndicator from '../shared/StatusIndicator'
import TableSkeleton from '../shared/TableSkeleton'
import TableEmptyState from '../shared/TableEmptyState'
import { formatDateTimeIST } from '../../lib/dateFormat'

export interface FileRow {
  id: string
  filename: string
  metaSynced: boolean
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
  lastEdited: string
}

export interface WebsiteRow {
  id: string
  url: string
  metaSynced: boolean
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
  lastEdited: string
}

function syncBadge(metaSynced: boolean) {
  if (metaSynced) {
    return <StatusIndicator label="Synced" tone="positive" />
  }
  return <StatusIndicator label="Not synced" tone="warning" />
}

// Founder-caught gap (2026-08-07): the legacy "Imported agent (id)" name
// already contains the phone number id, so unconditionally appending it
// again rendered "Imported agent (123) (123)". Only append when it isn't
// already present in the name.
function deployedOn(agentName: string | null, phoneNumberId: string | null) {
  const name = agentName ?? 'Unknown agent'
  const alreadyShown = phoneNumberId != null && name.includes(phoneNumberId)
  return `${name}${phoneNumberId && !alreadyShown ? ` (${phoneNumberId})` : ''}`
}

export function FilesTable({
  isLoading, rows, deletingId, onDelete,
}: {
  isLoading: boolean
  rows: FileRow[]
  deletingId: string | null
  onDelete: (row: FileRow) => void
}) {
  if (isLoading) return <TableSkeleton />
  if (rows.length === 0) return <TableEmptyState icon={<FileText className="h-8 w-8 text-muted-foreground mb-2" />} text="No files uploaded yet." />

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
          <tr key={row.id} className="hover:bg-muted/30">
            <td className="px-4 py-3 text-sm font-medium text-foreground max-w-xs truncate">{row.filename}</td>
            <td className="px-4 py-3">{syncBadge(row.metaSynced)}</td>
            <td className="px-4 py-3 text-muted-foreground">{deployedOn(row.agentName, row.phoneNumberId)}</td>
            <td className="px-4 py-3 text-muted-foreground">{formatDateTimeIST(row.lastEdited)}</td>
            {/* Founder-caught gap (2026-08-07): no edit action existed, only
                delete. This page is a cross-agent rollup; the file's real
                management UI (replace/re-upload) lives on its owning agent's
                Knowledge tab. */}
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <Link
                  to={`/agents/${row.agentId}?tab=knowledge`}
                  aria-label={`Edit file ${row.filename}`}
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => onDelete(row)}
                  disabled={deletingId === row.id}
                  aria-label={`Delete file ${row.filename}`}
                  className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                  {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function WebsitesTable({
  isLoading, rows, deletingId, onDelete,
}: {
  isLoading: boolean
  rows: WebsiteRow[]
  deletingId: string | null
  onDelete: (row: WebsiteRow) => void
}) {
  if (isLoading) return <TableSkeleton />
  if (rows.length === 0) return <TableEmptyState icon={<Globe className="h-8 w-8 text-muted-foreground mb-2" />} text="No websites added yet." />

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs font-medium text-muted-foreground">
          <th className="px-4 py-3">URL</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Deployed on</th>
          <th className="px-4 py-3">Last edited</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-muted/30">
            <td className="px-4 py-3 text-sm font-medium text-foreground max-w-xs truncate">{row.url}</td>
            <td className="px-4 py-3">{syncBadge(row.metaSynced)}</td>
            <td className="px-4 py-3 text-muted-foreground">{deployedOn(row.agentName, row.phoneNumberId)}</td>
            <td className="px-4 py-3 text-muted-foreground">{formatDateTimeIST(row.lastEdited)}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <Link
                  to={`/agents/${row.agentId}?tab=knowledge`}
                  aria-label={`Edit website ${row.url}`}
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => onDelete(row)}
                  disabled={deletingId === row.id}
                  aria-label={`Delete website ${row.url}`}
                  className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                  {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

