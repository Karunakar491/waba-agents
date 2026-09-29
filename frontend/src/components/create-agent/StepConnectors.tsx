import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Library, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { extractErrorMessage } from '../../lib/errors'
import ErrorBanner from '../shared/ErrorBanner'
import ConnectorDeployModal from '../connectors/ConnectorDeployModal'
import type { LibraryConnector } from '../connectors/connectorLibrary'
import { BottomBar, LinkAction, SectionCard, StepHeader } from './WizardChrome'

interface Connector {
  id: string
  name?: string
  description?: string
  base_url?: string
}

/**
 * Screen: Create Agent — Step 5, Connectors (Figma node 252:35).
 *
 * The ad-hoc "New connector" form is removed here (1/2 of this change) —
 * it's replaced by the shared connector editor next commit. This half keeps
 * Import from Library and the deployed-connectors list working meanwhile.
 */
export default function StepConnectors({
  agentId,
  wabaId,
  onBack,
  onNext,
}: {
  agentId: string | null
  wabaId: string
  onBack: () => void
  onNext: () => void
}) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [deployTarget, setDeployTarget] = useState<LibraryConnector | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)

  const onError = (err: unknown) => setError(extractErrorMessage(err))

  const { data: connectors = [] } = useQuery<Connector[]>({
    queryKey: ['agent-connectors', agentId],
    queryFn: () => api.get(`/agents/${agentId}/connectors`).then((r) => r.data.data ?? []),
    enabled: !!agentId,
  })

  // The real Connector Library (V46) — reusable definitions, not the live
  // rollup. Picking one here deploys that definition onto this agent.
  const { data: libraryConnectors = [] } = useQuery<LibraryConnector[]>({
    queryKey: ['connector-library', wabaId],
    queryFn: () =>
      api.get('/connector-library', { params: { wabaId } }).then((r) => r.data.data ?? []),
    enabled: importOpen && !!wabaId,
  })

  const { data: agents = [] } = useQuery<{ id: string; displayName: string; phoneNumberId: string | null }[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data ?? []),
    enabled: !!agentId,
  })
  const thisAgent = agents.find((a) => a.id === agentId) ?? null

  const deployFromLibrary = useMutation({
    mutationFn: ({ id, secrets }: { id: string; secrets: Record<string, string> }) =>
      api.post(`/connector-library/${id}/deploy`, { agentId, secrets }),
    onSuccess: () => {
      setDeployTarget(null)
      setDeployError(null)
      setImportOpen(false)
      void qc.invalidateQueries({ queryKey: ['agent-connectors', agentId] })
      void qc.invalidateQueries({ queryKey: ['connector-library', wabaId] })
    },
    onError: (err) => setDeployError(extractErrorMessage(err)),
  })

  const removeConnector = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${agentId}/connectors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-connectors', agentId] }),
    onError,
  })

  return (
    <>
      <StepHeader
        title="What systems does it need?"
        subtitle="For things it can't just know — like checking a real order status. Pick a real system to connect."
      />

      {error && (
        <div className="mb-6">
          <ErrorBanner error={error} />
        </div>
      )}

      <SectionCard
        title="Connect your systems"
        description="For things it can't just know — like checking a real order status. Iris can't invent these; pick a real system to connect."
        footnote="None of these? You can skip this step — add a connector any time from the agent's settings."
        actions={
          // The Connector Library is real now (V46), so this is a live
          // control: it lists reusable definitions and deploys one straight
          // onto this agent. Saving a NEW definition still happens on the
          // Library page — the wizard is where you use the library, not where
          // you curate it.
          <LinkAction
            onClick={() => setImportOpen((o) => !o)}
            icon={<Library className="h-4 w-4" />}
            disabled={!wabaId}
          >
            Import from Library
          </LinkAction>
        }
      >
        {importOpen && (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-foreground">Your Connector Library</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reusable definitions. Deploying one here puts it on this agent — you only enter the credentials.
            </p>
            {libraryConnectors.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing saved to the library yet — build one below, or add it in Library → Connectors.
              </p>
            ) : (
              <ul className="mt-3 divide-y">
                {libraryConnectors.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.systemType ? `${c.systemType} · ` : ''}
                        {c.usedByAgentCount === 0
                          ? 'Not deployed yet'
                          : `Used by ${c.usedByAgentCount} agent${c.usedByAgentCount === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <LinkAction
                      onClick={() => {
                        setDeployError(null)
                        setDeployTarget(c)
                      }}
                    >
                      Deploy here
                    </LinkAction>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {connectors.length > 0 && (
          <ul className="divide-y">
            {connectors.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.name ?? c.id}</p>
                  {c.base_url && (
                    <p className="truncate text-xs text-muted-foreground">{c.base_url}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeConnector.mutate(c.id)}
                  aria-label={`Remove connector: ${c.name ?? c.id}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {deployTarget && agentId && (
        <ConnectorDeployModal
          connector={deployTarget}
          agents={[
            {
              id: agentId,
              displayName: thisAgent?.displayName ?? 'This agent',
              phoneNumberId: thisAgent?.phoneNumberId ?? null,
            },
          ]}
          deploying={deployFromLibrary.isPending}
          error={deployError}
          onDeploy={(_agentId, secrets) => deployFromLibrary.mutate({ id: deployTarget.id, secrets })}
          onClose={() => {
            setDeployTarget(null)
            setDeployError(null)
          }}
        />
      )}

      <BottomBar onBack={onBack} onNext={onNext} />
    </>
  )
}
