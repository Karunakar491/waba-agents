import { Pencil, LayoutGrid } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusIndicator from '../shared/StatusIndicator'
import TableSkeleton from '../shared/TableSkeleton'
import TableEmptyState from '../shared/TableEmptyState'

export interface UiSkillRow {
  id: string
  title: string
  componentType: string
  status: 'enabled' | 'disabled'
  instruction: string
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
}

const COMPONENT_LABELS: Record<string, string> = {
  carousel_quick_reply: 'Carousel (quick reply)',
  carousel_url: 'Carousel (URL)',
  cta_url: 'CTA button (URL)',
  image: 'Image',
  interactive_list: 'Interactive list',
  location: 'Location',
  location_request: 'Location request',
}

// F22 (2026-08-07) — cross-agent UI Skills rollup for the Skill Library,
// same "rollup, not source of truth" convention as ConnectorsTable/
// FileWebsiteTables: no Library/attachment concept exists for UI skills
// (each is tied directly to one phone number on Meta's side), so Edit
// deep-links to the owning agent's Skills tab instead of editing in place.
export function UiSkillsLibraryTable({ isLoading, rows }: { isLoading: boolean; rows: UiSkillRow[] }) {
  if (isLoading) return <TableSkeleton />
  if (rows.length === 0) {
    return (
      <TableEmptyState
        icon={<LayoutGrid className="h-8 w-8 text-muted-foreground mb-2" />}
        text="No UI skills yet — add one from an agent's Skills tab."
      />
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs font-medium text-muted-foreground">
          <th className="px-4 py-3">Title</th>
          <th className="px-4 py-3">Component</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Agent</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-muted/30">
            <td className="px-4 py-3 max-w-xs">
              <p className="text-sm font-medium text-foreground truncate">{row.title}</p>
              <p className="text-xs text-muted-foreground truncate">{row.instruction}</p>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {COMPONENT_LABELS[row.componentType] ?? row.componentType}
            </td>
            <td className="px-4 py-3">
              <StatusIndicator
                label={row.status === 'enabled' ? 'Enabled' : 'Disabled'}
                tone={row.status === 'enabled' ? 'positive' : 'neutral'}
              />
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {row.agentName ?? 'Unknown agent'}
              {row.phoneNumberId && !(row.agentName ?? '').includes(row.phoneNumberId) ? ` (${row.phoneNumberId})` : ''}
            </td>
            <td className="px-4 py-3 text-right">
              <Link
                to={`/agents/${row.agentId}?tab=skills`}
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
