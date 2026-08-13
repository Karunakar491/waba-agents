import { Cable, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
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
  /**
   * Below here: backed by the local connector mirror (agent_connector, V45).
   * authType/baseUrl come from Meta; systemType/tags/publishedToLibrary are
   * ours (Meta has no such concept). usedByAgentCount is heuristic — Meta's
   * connector ids are per-phone-number, so it groups by name + base URL.
   */
  authType: string | null
  baseUrl: string | null
  systemType: string | null
  tags: string[]
  publishedToLibrary: boolean
  usedByAgentCount: number
  /** True when this row was served from the mirror because Meta was unreachable. */
  cached: boolean
  lastSyncedAt: string | null
  /**
   * Set when this live connector is a deployment of a Connector Library
   * definition (connector_deployment, V46) — in that case usedByAgentCount
   * above is a real count, not the heuristic.
   */
  libraryConnectorId: string | null
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
          <th className="px-4 py-3 text-right">Actions</th>
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
              {/* Founder-caught gap (2026-08-07): legacy "Imported agent (id)"
                  names already contain the phone id, so appending it again
                  rendered it twice. */}
              {row.agentName ?? 'Unknown agent'}
              {row.phoneNumberId && !(row.agentName ?? '').includes(row.phoneNumberId) ? ` (${row.phoneNumberId})` : ''}
            </td>
            {/* Founder-caught gap (2026-08-07): no edit action existed at all.
                This page is a cross-agent rollup, not the source of truth —
                the connector's real config lives on its owning agent, so Edit
                deep-links there rather than duplicating the edit UI here. */}
            <td className="px-4 py-3 text-right">
              <Link
                to={`/agents/${row.agentId}?tab=connectors`}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
