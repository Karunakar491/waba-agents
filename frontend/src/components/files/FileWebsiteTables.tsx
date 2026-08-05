import { FileText, Globe, Loader2, Trash2 } from 'lucide-react'
import StatusIndicator from '../shared/StatusIndicator'
import TableSkeleton from '../shared/TableSkeleton'
import TableEmptyState from '../shared/TableEmptyState'

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

function deployedOn(agentName: string | null, phoneNumberId: string | null) {
  return `${agentName ?? 'Unknown agent'}${phoneNumberId ? ` (${phoneNumberId})` : ''}`
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
            <td className="px-4 py-3 text-muted-foreground">{new Date(row.lastEdited).toLocaleString()}</td>
            <td className="px-4 py-3 text-right">
              <button
                onClick={() => onDelete(row)}
                disabled={deletingId === row.id}
                aria-label={`Delete file ${row.filename}`}
                className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
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
            <td className="px-4 py-3 text-muted-foreground">{new Date(row.lastEdited).toLocaleString()}</td>
            <td className="px-4 py-3 text-right">
              <button
                onClick={() => onDelete(row)}
                disabled={deletingId === row.id}
                aria-label={`Delete website ${row.url}`}
                className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              >
                {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

