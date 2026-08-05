import { Cable } from 'lucide-react'
import StatusIndicator, { type StatusTone } from '../shared/StatusIndicator'
import TableSkeleton from '../shared/TableSkeleton'
import TableEmptyState from '../shared/TableEmptyState'

export interface ConnectorRow {
  id: string
  name: string
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
  status: string | null
}

function statusTone(status: string | null): StatusTone {
  if (status === 'ACTIVE') return 'positive'
  if (status === 'PENDING_OAUTH') return 'warning'
  if (status === 'ERROR' || status === 'EXPIRED') return 'negative'
  return 'neutral'
}

function statusLabel(status: string | null): string {
  if (status === 'ACTIVE') return 'Connected'
  if (status === 'PENDING_OAUTH') return 'Pending authorization'
  if (status === 'EXPIRED') return 'Expired'
  if (status === 'ERROR') return 'Error'
  return 'Unknown'
}

export function ConnectorsTable({ isLoading, rows }: { isLoading: boolean; rows: ConnectorRow[] }) {
  if (isLoading) return <TableSkeleton />
  if (rows.length === 0) {
    return (
      <TableEmptyState
        icon={<Cable className="h-8 w-8 text-muted-foreground mb-2" />}
        text="No connectors yet — add one from an agent's Connectors tab."
      />
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs font-medium text-muted-foreground">
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Deployed on</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr key={`${row.agentId}-${row.id}`} className="hover:bg-muted/30">
            <td className="px-4 py-3 text-sm font-medium text-foreground">{row.name}</td>
            <td className="px-4 py-3">
              <StatusIndicator label={statusLabel(row.status)} tone={statusTone(row.status)} />
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {row.agentName ?? 'Unknown agent'}{row.phoneNumberId ? ` (${row.phoneNumberId})` : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
