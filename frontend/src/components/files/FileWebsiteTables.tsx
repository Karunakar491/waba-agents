import type { ReactNode } from 'react'
import { FileText, Globe, Loader2, Trash2 } from 'lucide-react'
import StatusIndicator from '../shared/StatusIndicator'

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
  if (rows.length === 0) return <EmptyState icon={<FileText className="h-8 w-8 text-muted-foreground mb-2" />} text="No files uploaded yet." />

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
  if (rows.length === 0) return <EmptyState icon={<Globe className="h-8 w-8 text-muted-foreground mb-2" />} text="No websites added yet." />

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

function TableSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
