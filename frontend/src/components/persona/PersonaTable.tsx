import { FileText, Loader2, Rocket, Trash2 } from 'lucide-react'
import type { BusinessProfileResponse } from '../agent-detail/BusinessProfileTab'
import StatusIndicator from '../shared/StatusIndicator'
import { formatDateTimeIST } from '../../lib/dateFormat'

// One row per profile, across every phone number this account can see —
// PM+EM gate (2026-07-30): drop the "Agent" column from the original ask,
// since BusinessProfile is 1:1 with a phone number, not multi-attached to
// agents the way Skills is. "Which number" and "Last touched" are the real
// relationships this data actually has.
export interface PersonaRow {
  profile: BusinessProfileResponse
  displayPhoneNumber: string | null
  lastTouched: string | null
}

interface PhoneEntry {
  phoneNumberId: string
  displayPhoneNumber: string
}

function statusBadge(status: string) {
  const config = {
    DRAFT: { label: 'Draft', tone: 'neutral' as const },
    DEPLOYED: { label: 'Published', tone: 'positive' as const },
    ARCHIVED: { label: 'Saved', tone: 'neutral' as const },
  }[status] ?? { label: status, tone: 'neutral' as const }
  return <StatusIndicator label={config.label} tone={config.tone} />
}

interface PersonaTableRowProps {
  row: PersonaRow
  phones: PhoneEntry[]
  deployTarget: string | undefined
  onDeployTargetChange: (phoneNumberId: string) => void
  onEdit: (profile: BusinessProfileResponse) => void
  onDeploy: () => void
  onDelete: () => void
  deploying: boolean
  isDeployingThis: boolean
}

function PersonaTableRow({
  row, phones, deployTarget, onDeployTargetChange, onEdit, onDeploy, onDelete, deploying, isDeployingThis,
}: PersonaTableRowProps) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 max-w-xs truncate">
        {row.profile.businessDescription || `Persona ${row.profile.id}`}
      </td>
      <td className="px-4 py-3">{statusBadge(row.profile.status)}</td>
      <td className="px-4 py-3 text-muted-foreground">{row.displayPhoneNumber ?? '—'}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {row.lastTouched ? formatDateTimeIST(row.lastTouched) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(row.profile)}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            {row.profile.status === 'DRAFT' ? 'Edit' : 'Edit as new draft'}
          </button>
          {row.profile.status === 'DRAFT' && (
            <>
            {phones.length > 0 && (
              <>
                <label htmlFor={`deploy-target-${row.profile.id}`} className="sr-only">
                  Choose a phone number to deploy this draft to
                </label>
                <select
                  id={`deploy-target-${row.profile.id}`}
                  className="rounded-lg border bg-background px-2 py-1.5 text-xs"
                  value={deployTarget ?? ''}
                  onChange={(e) => onDeployTargetChange(e.target.value)}
                >
                  <option value="">Deploy to...</option>
                  {phones.map((p) => (
                    <option key={p.phoneNumberId} value={p.phoneNumberId}>
                      {p.displayPhoneNumber}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button
              onClick={onDeploy}
              disabled={deploying || !deployTarget}
              className="flex items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3 py-1.5 text-xs font-semibold
                text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeployingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              Deploy
            </button>
            <button
              onClick={onDelete}
              aria-label="Delete draft"
              className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

interface PersonaTableProps {
  isLoading: boolean
  totalCount: number
  filteredRows: PersonaRow[]
  phones: PhoneEntry[]
  deployTargets: Record<string, string>
  onDeployTargetChange: (draftId: string, phoneNumberId: string) => void
  onEdit: (profile: BusinessProfileResponse) => void
  onDeploy: (draftId: string, phoneNumberId: string) => void
  onDelete: (draftId: string) => void
  deploying: boolean
  deployingDraftId: string | null
}

export function PersonaTable({
  isLoading, totalCount, filteredRows, phones, deployTargets, onDeployTargetChange,
  onEdit, onDeploy, onDelete, deploying, deployingDraftId,
}: PersonaTableProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
      </div>
    )
  }

  if (filteredRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {totalCount === 0
            ? 'No business personas yet. Create a draft to define payment terms, return policy, and contact info.'
            : 'No personas match your search or filter.'}
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
          <th className="px-4 py-3">Phone number</th>
          <th className="px-4 py-3">Last touched</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {filteredRows.map((row) => (
          <PersonaTableRow
            key={`${row.profile.status}-${row.profile.id}`}
            row={row}
            phones={phones}
            deployTarget={deployTargets[row.profile.id]}
            onDeployTargetChange={(phoneNumberId) => onDeployTargetChange(row.profile.id, phoneNumberId)}
            onEdit={onEdit}
            onDeploy={() => {
              const target = deployTargets[row.profile.id]
              if (target) onDeploy(row.profile.id, target)
            }}
            onDelete={() => onDelete(row.profile.id)}
            deploying={deploying}
            isDeployingThis={deploying && deployingDraftId === row.profile.id}
          />
        ))}
      </tbody>
    </table>
  )
}
