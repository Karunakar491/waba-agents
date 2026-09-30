import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import Modal from '../shared/Modal'
import ErrorBanner from '../shared/ErrorBanner'
import ConsequenceLine from '../shared/ConsequenceLine'
import StatusIndicator from '../shared/StatusIndicator'
import { type Connector } from './connectors'

export interface PublishResult {
  agentId: string
  agentName: string | null
  success: boolean
  message: string | null
}

/**
 * Screen: republish a connector to every agent already running it.
 *
 * The founder's own words: "User should see what all agents it is deployed.
 * When the user clicks on publish button, All the numbers on which it is
 * deployed should be shown as a modal and a checkbox should be given. If he
 * clicks on all of them and publishes it should publish on everything."
 *
 * Distinct from {@link ConnectorDeployModal}, which puts this connector on an
 * agent it is NOT yet running on and always asks for credentials. This modal
 * only ever targets agents that already have a deployment, and reuses each
 * one's stored credentials (V64) — nobody re-types a key to fix drift.
 */
export default function ConnectorRepublishModal({
  connector,
  publishing,
  results,
  error,
  onPublish,
  onClose,
}: {
  connector: Connector
  publishing: boolean
  /** Set once the call returns — per-agent outcome, shown in place of the checklist. */
  results: PublishResult[] | null
  error: string | null
  onPublish: (agentIds: string[]) => void
  onClose: () => void
}) {
  // None ticked by default — the founder's explicit spec, so a stray click on
  // Publish cannot redeploy an agent nobody meant to touch.
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const deployments = connector.deployments
  const allChecked = deployments.length > 0 && deployments.every((d) => checked[d.agentId])

  function toggleAll() {
    if (allChecked) {
      setChecked({})
    } else {
      setChecked(Object.fromEntries(deployments.map((d) => [d.agentId, true])))
    }
  }

  const selectedIds = deployments.filter((d) => checked[d.agentId]).map((d) => d.agentId)

  return (
    <Modal
      title={`Publish “${connector.name}” to its agents`}
      onClose={onClose}
      preventClose={publishing}
      maxWidthClassName="max-w-lg"
    >
      <div className="space-y-4">
        {error && <ErrorBanner error={error} />}

        {results ? (
          <>
            <ConsequenceLine>Done. Here is what happened on each agent.</ConsequenceLine>
            <ul className="divide-y rounded-lg border">
              {results.map((r) => (
                <li key={r.agentId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm text-foreground">
                    {r.agentName ?? r.agentId}
                  </span>
                  <StatusIndicator
                    label={r.success ? 'Published' : (r.message ?? 'Failed')}
                    tone={r.success ? 'positive' : 'negative'}
                  />
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <ConsequenceLine>
              Reuses each agent's stored credentials — nobody has to type a key in again.
            </ConsequenceLine>

            {deployments.length === 0 ? (
              <p className="text-sm text-muted-foreground">This connector is not on any agent yet.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 border-b pb-2 text-sm font-medium text-foreground">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4" />
                  Select all
                </label>
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {deployments.map((d) => (
                    <li key={d.agentId}>
                      <label className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={!!checked[d.agentId]}
                          onChange={(e) =>
                            setChecked((c) => ({ ...c, [d.agentId]: e.target.checked }))
                          }
                          className="h-4 w-4"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {d.agentName ?? d.agentId}
                        </span>
                        <StatusIndicator
                          label={d.status === 'OUT_OF_SYNC' ? 'Behind' : 'Up to date'}
                          tone={d.status === 'OUT_OF_SYNC' ? 'warning' : 'positive'}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={publishing}
                className="rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onPublish(selectedIds)}
                disabled={publishing || selectedIds.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-accent-teal-solid px-3.5 py-2 text-sm font-semibold
                  text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Publish to {selectedIds.length || 'selected'} agent{selectedIds.length === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
