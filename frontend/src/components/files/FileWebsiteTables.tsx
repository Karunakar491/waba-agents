import { FileText, Globe, Loader2, MessageSquareText, Trash2 } from 'lucide-react'
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

export interface FaqRow {
  id: string
  question: string
  answer: string
  metaSynced: boolean
  /** Meta's published/unpublished lifecycle — files and websites have none. */
  status: string | null
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
  metaAgentId: string | null
  lastEdited: string | null
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
function deployedOnLabel(agentName: string | null, phoneNumberId: string | null) {
  const name = agentName ?? 'Unknown agent'
  const alreadyShown = phoneNumberId != null && name.includes(phoneNumberId)
  return `${name}${phoneNumberId && !alreadyShown ? ` (${phoneNumberId})` : ''}`
}

/**
 * The owning agent, as a link the user can choose to follow.
 *
 * This column used to be plain text sitting beside a pencil that navigated
 * here anyway. The pencil promised an editor that does not exist — there is no
 * per-file endpoint at all, only upload and delete — so clicking it dropped the
 * user on an agent page they never asked for (founder, 2026-09-06: "when
 * someone clicks on anything, it is unnecessarily redirecting to the agents
 * page"). Now the only thing that navigates is the agent's own name, which says
 * where it goes before you click it.
 */
function DeployedOn({
  agentId,
  agentName,
  phoneNumberId,
}: {
  agentId: string
  agentName: string | null
  phoneNumberId: string | null
}) {
  return (
    <Link
      to={`/agents/${agentId}?tab=knowledge`}
      className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
    >
      {deployedOnLabel(agentName, phoneNumberId)}
    </Link>
  )
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
            <td className="px-4 py-3">
              <DeployedOn agentId={row.agentId} agentName={row.agentName} phoneNumberId={row.phoneNumberId} />
            </td>
            <td className="px-4 py-3 text-muted-foreground">{formatDateTimeIST(row.lastEdited)}</td>
            {/* An Edit pencil was added here on 2026-08-07 to fill an apparently
                missing action. It never edited anything — there is no per-file
                endpoint, only upload and delete — it just navigated to the
                owning agent. Removed 2026-09-06: an action that does something
                other than what its icon says is worse than a missing action.
                The agent is still one click away, on its own name. */}
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
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
            <td className="px-4 py-3">
              <DeployedOn agentId={row.agentId} agentName={row.agentName} phoneNumberId={row.phoneNumberId} />
            </td>
            <td className="px-4 py-3 text-muted-foreground">{formatDateTimeIST(row.lastEdited)}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
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


/**
 * FAQs across every agent on the WABA.
 *
 * The Knowledge Base screen listed files and websites but no FAQs at all
 * (founder, 2026-09-07: "FAQ's are still not visible in knowledge base"),
 * because FAQs only ever had per-agent endpoints — nothing rolled them up the
 * way /files and /websites do. The endpoint now exists and this is its table.
 *
 * It carries a state column the other two do not need: an FAQ can be
 * unpublished from Meta while staying in our database, so "Synced" alone would
 * misreport a withdrawn answer as live.
 *
 * Read-only for now, deliberately. Editing an FAQ writes through to a live
 * agent immediately, and the per-agent Knowledge tab is where that already
 * happens with its own confirmations — a second, thinner editor here would be a
 * second thing to keep right.
 */
export function FaqsTable({ isLoading, rows }: { isLoading: boolean; rows: FaqRow[] }) {
  if (isLoading) return <TableSkeleton />
  if (rows.length === 0)
    return (
      <TableEmptyState
        icon={<MessageSquareText className="h-8 w-8 text-muted-foreground mb-2" />}
        text="No FAQs yet. Add them on an agent's Knowledge tab and they show up here."
      />
    )

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs font-medium text-muted-foreground">
          <th className="px-4 py-3">Question</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Deployed on</th>
          <th className="px-4 py-3">Last edited</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-muted/30">
            <td className="max-w-md px-4 py-3">
              <p className="truncate text-sm font-medium text-foreground" title={row.question}>
                {row.question}
              </p>
              <p className="truncate text-xs text-muted-foreground" title={row.answer}>
                {row.answer}
              </p>
            </td>
            <td className="px-4 py-3">
              {/* Unpublished beats synced: an answer withdrawn from Meta is not
                  reaching customers, whatever our sync state says. */}
              {row.status && row.status.toLowerCase() !== 'published' ? (
                <StatusIndicator label="Draft — not live" tone="warning" />
              ) : (
                syncBadge(row.metaSynced)
              )}
            </td>
            <td className="px-4 py-3">
              <DeployedOn
                agentId={row.agentId}
                agentName={row.agentName}
                phoneNumberId={row.phoneNumberId}
              />
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {row.lastEdited ? formatDateTimeIST(row.lastEdited) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
