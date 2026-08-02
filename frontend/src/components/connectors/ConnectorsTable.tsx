import { Cable } from 'lucide-react'

export interface ConnectorRow {
  id: string
  name: string
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
}

export function ConnectorsTable({ isLoading, rows }: { isLoading: boolean; rows: ConnectorRow[] }) {
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
        <Cable className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No connectors yet — add one from an agent's Connectors tab.
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
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr key={`${row.agentId}-${row.id}`} className="hover:bg-muted/30">
            <td className="px-4 py-3 text-sm font-medium text-foreground">{row.name}</td>
            <td className="px-4 py-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-2.5 py-0.5 text-xs font-medium text-brand-green">
                Connected
              </span>
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
