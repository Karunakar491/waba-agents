import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Rocket, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { extractErrorMessage } from '../lib/errors'
import type { ConnectorRow } from '../components/connectors/ConnectorsTable'
import type { StatusTone } from '../components/shared/StatusIndicator'
import LibraryTable, { LibraryTableSkeleton } from '../components/library/LibraryTable'
import LibraryToolbar from '../components/library/LibraryToolbar'
import ErrorBanner from '../components/shared/ErrorBanner'
import ConfirmDeleteModal from '../components/shared/ConfirmDeleteModal'
import { useActionFeedback } from '../components/shared/ActionFeedback'
import ConnectorDefinitionEditor from '../components/connectors/ConnectorDefinitionEditor'
import ConnectorDeployModal, { type DeployTargetAgent } from '../components/connectors/ConnectorDeployModal'
import {
  EMPTY_CONNECTOR_FORM,
  toRequestBody,
  type ConnectorFormValues,
  type LibraryConnector,
} from '../components/connectors/connectorLibrary'

/**
 * Screen: ConnectorLibraryPage
 *
 * 1. USER GOAL: Define an integration once, deploy it to whichever agents
 *    need it, and see everything already wired up anywhere on the account.
 * 2. EMOTIONAL STATE: Building ("I want this reusable") or auditing ("what
 *    are we connected to, and is any of it broken?").
 * 3. POSSIBLE ACTIONS: create/edit/publish a definition, deploy one to an
 *    agent, search and filter, jump to the agent that owns a live connector.
 * 4. HOW WE HELP: two honestly-labelled sections. "Your connectors" is our
 *    own reusable definitions — real create/edit/deploy. "Live on agents" is
 *    what Meta currently reports; it stays a rollup, edited on the agent.
 *
 * WHY TWO SECTIONS AND NOT ONE MERGED GRID: a library definition has no
 * agent and no Meta connection status; a live connector has no draft state
 * and can't be redeployed elsewhere. Merging them would have needed a fake
 * status for one half of the rows. The Skills Library merges its two sources
 * because both really are "a skill"; these two genuinely are not the same
 * object.
 */

interface ConnectorListPayload {
  connectors: ConnectorRow[]
  /** Meta was unreachable for at least one agent — these rows are last-synced, not live. */
  cached: boolean
}

interface WabaEntry {
  id: string
  wabaId: string
  label: string | null
  status: string
}

interface AgentEntry {
  id: string
  displayName: string
  phoneNumberId: string | null
  wabaId: string | null
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

function authTypeLabel(authType: string | null): string | null {
  if (authType === 'OAUTH2_CLIENT_CREDENTIALS') return 'OAuth 2.0'
  if (authType === 'API_KEY') return 'API key'
  if (authType === 'NONE') return 'No auth'
  return authType
}

/** System type first (what it connects to), then how it authenticates, then our own tags. */
function cardTags(row: ConnectorRow): string[] {
  const auth = authTypeLabel(row.authType)
  return [
    ...(row.systemType ? [row.systemType] : []),
    ...(auth ? [auth] : []),
    ...(row.publishedToLibrary ? ['Published'] : []),
    ...row.tags,
  ]
}

/**
 * Agents running an older version than the one saved here. Shown under the
 * "used by" count rather than folded into it, because these two numbers answer
 * different questions: how much does an edit affect, and how much of that is
 * already stale.
 */
function outOfSyncNote(connector: LibraryConnector): string | null {
  const outOfSync = connector.deployments.filter((d) => d.status === 'OUT_OF_SYNC').length
  return outOfSync > 0 ? `${outOfSync} need redeploying` : null
}

export default function ConnectorLibraryPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [agentFilter, setAgentFilter] = useState('ALL')

  const [showEditor, setShowEditor] = useState(false)
  const [form, setForm] = useState<ConnectorFormValues>(EMPTY_CONNECTOR_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [deployTarget, setDeployTarget] = useState<LibraryConnector | null>(null)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  // Connector delete used to fire immediately, while Skills, Files and WABAs
  // all asked first. Uneven confirmation is worse than none: it teaches a habit
  // the app then breaks, and a connector can be live on several agents.
  const [pendingDelete, setPendingDelete] = useState<LibraryConnector | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { confirm } = useActionFeedback()

  const { data: wabas = [], isLoading: wabasLoading } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  const { data: agents = [] } = useQuery<AgentEntry[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data ?? []),
  })

  const { data: libraryConnectors = [], isLoading: libraryLoading } = useQuery<LibraryConnector[]>({
    queryKey: ['connector-library', waba?.id],
    queryFn: () => api.get('/connector-library', { params: { wabaId: waba!.id } }).then((r) => r.data.data ?? []),
    enabled: !!waba,
  })

  const { data: connectorPayload, isLoading: connectorsLoading } = useQuery<ConnectorListPayload>({
    queryKey: ['library-connectors', waba?.id],
    queryFn: () =>
      api
        .get('/connectors', { params: { wabaId: waba!.id } })
        .then((r) => ({ connectors: r.data.data?.connectors ?? [], cached: r.data.data?.cached ?? false })),
    enabled: !!waba,
  })
  const connectors = connectorPayload?.connectors ?? []
  const isCached = connectorPayload?.cached ?? false

  const deployTargets: DeployTargetAgent[] = useMemo(
    () =>
      agents
        .filter((a) => !waba || a.wabaId === waba.id)
        .map((a) => ({ id: a.id, displayName: a.displayName, phoneNumberId: a.phoneNumberId })),
    [agents, waba],
  )

  /** A connector's name from its id, for confirmations that fire after it is gone. */
  const nameOf = (id: string) =>
    libraryConnectors.find((c) => c.id === id)?.name ?? 'Connector'

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['connector-library', waba?.id] })
    void queryClient.invalidateQueries({ queryKey: ['library-connectors', waba?.id] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: ConnectorFormValues) =>
      // Create only. Editing an existing connector navigates to its own page,
      // which is the only place that can also define what the connector does.
      api.post('/connector-library', { wabaId: waba!.id, ...toRequestBody(values) }),
    onSuccess: (_data, values) => {
      invalidate()
      setShowEditor(false)
      setForm(EMPTY_CONNECTOR_FORM)
      setFormError(null)
      confirm('Connector saved', `${values.name} — add an action so an agent can call it`)
    },
    onError: (err) => setFormError(extractErrorMessage(err)),
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/connector-library/${id}/publish`),
    onSuccess: (_data, id) => {
      invalidate()
      confirm('Connector published', nameOf(id))
    },
    onError: (err) => setPageError(extractErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/connector-library/${id}`),
    onSuccess: (_data, id) => {
      invalidate()
      setPendingDelete(null)
      confirm('Connector deleted', nameOf(id))
    },
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  })

  const deployMutation = useMutation({
    mutationFn: ({ id, agentId, secrets }: { id: string; agentId: string; secrets: Record<string, string> }) =>
      api.post(`/connector-library/${id}/deploy`, { agentId, secrets }),
    onSuccess: (_data, { id, agentId }) => {
      invalidate()
      setDeployTarget(null)
      setDeployError(null)
      const agent = agents.find((a) => a.id === agentId)
      confirm('Connector deployed', `${nameOf(id)} → ${agent?.displayName ?? 'the agent'}`)
    },
    onError: (err) => setDeployError(extractErrorMessage(err)),
  })

  function startCreate() {
    setForm(EMPTY_CONNECTOR_FORM)
    setFormError(null)
    setShowEditor(true)
  }

  const agentOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const c of connectors) byId.set(c.agentId, c.agentName ?? 'Unknown agent')
    return Array.from(byId, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [connectors])

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(connectors.map((c) => c.status ?? 'UNKNOWN')))
        .map((value) => ({ value, label: statusLabel(value === 'UNKNOWN' ? null : value) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [connectors],
  )

  const query = search.trim().toLowerCase()

  const filteredLibrary = useMemo(
    () =>
      libraryConnectors
        .filter((c) => !query || c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [libraryConnectors, query],
  )

  const filteredRows = useMemo(
    () =>
      connectors
        .filter((c) => !query || c.name.toLowerCase().includes(query))
        .filter((c) => statusFilter === 'ALL' || (c.status ?? 'UNKNOWN') === statusFilter)
        .filter((c) => agentFilter === 'ALL' || c.agentId === agentFilter)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [connectors, query, statusFilter, agentFilter],
  )

  const isLoading = wabasLoading || connectorsLoading || libraryLoading

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Connectors Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define an integration once, then deploy it to any agent
            {waba ? ` on ${waba.label ?? waba.wabaId}` : ''}. Definitions live here; credentials are entered at
            deploy time and go straight to Meta.
          </p>
        </div>
        <button
          onClick={startCreate}
          disabled={!waba}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2 text-sm font-medium
            text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New connector
        </button>
      </div>

      {!isLoading && !waba ? (
        <div className="rounded-xl border border-l-4 border-l-accent-teal-solid bg-card p-6 shadow-surface-resting">
          <p className="text-base font-semibold text-foreground">No WABA connected yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Connect a WABA and every integration your agents use will be listed here.
          </p>
        </div>
      ) : (
        <>
          {pageError && <ErrorBanner error={pageError} />}

          {/* Honest about what the operator is looking at: if Meta was
              unreachable we still render the last-synced mirror rather than an
              empty page, but we never let it pass as live. */}
          {isCached && (
            <div className="rounded-xl border border-l-4 border-l-warning bg-card p-4 shadow-surface-resting">
              <p className="text-sm font-semibold text-foreground">Showing last-synced data</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Meta could not be reached for at least one agent, so some connectors below are from the last successful
                sync. Status may have changed since.
              </p>
            </div>
          )}

          <LibraryToolbar
            searchId="connector-search"
            searchLabel="Search connectors by name"
            searchPlaceholder="Search connectors…"
            search={search}
            onSearchChange={setSearch}
            filters={[
              ...(agentOptions.length > 0
                ? [{ id: 'connector-agent-filter', label: 'Agent', value: agentFilter, onChange: setAgentFilter, options: agentOptions }]
                : []),
              ...(statusOptions.length > 0
                ? [{ id: 'connector-status-filter', label: 'Status', value: statusFilter, onChange: setStatusFilter, options: statusOptions }]
                : []),
            ]}
          />

          {showEditor && (
            <ConnectorDefinitionEditor
              isEditing={false}
              form={form}
              error={formError}
              saving={saveMutation.isPending}
              onChange={setForm}
              onSave={() => {
                setFormError(null)
                saveMutation.mutate(form)
              }}
              onCancel={() => {
                setShowEditor(false)
                setForm(EMPTY_CONNECTOR_FORM)
                setFormError(null)
              }}
            />
          )}

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Your connectors</h2>
              <p className="text-sm text-muted-foreground">
                Reusable definitions. Editing one doesn't touch any agent until you redeploy it.
              </p>
            </div>

            {isLoading ? (
              <LibraryTableSkeleton />
            ) : filteredLibrary.length === 0 ? (
              <div className="rounded-xl border border-l-4 border-l-accent-teal-solid bg-card p-6 shadow-surface-resting">
                <p className="text-base font-semibold text-foreground">
                  {libraryConnectors.length === 0 ? 'No reusable connectors yet' : 'Nothing matches that search'}
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {libraryConnectors.length === 0
                    ? 'Define one here and deploy it to as many agents as you like — you only describe it once.'
                    : 'Search for a different word to see the rest of your connectors.'}
                </p>
              </div>
            ) : (
              <LibraryTable
                itemLabel="Connector"
                rows={filteredLibrary.map((connector) => ({
                  id: connector.id,
                  name: connector.name,
                  detail: connector.baseUrl,
                  tags: [
                    ...(connector.systemType ? [connector.systemType] : []),
                    ...(authTypeLabel(connector.authType) ? [authTypeLabel(connector.authType)!] : []),
                    ...connector.tags,
                  ],
                  statusLabel: connector.status === 'PUBLISHED' ? 'Published' : 'Draft',
                  statusTone:
                    connector.status === 'PUBLISHED' ? ('positive' as const) : ('neutral' as const),
                  usedByCount: connector.usedByAgentCount,
                  usedByNote: outOfSyncNote(connector),
                  updatedAt: connector.updatedAt,
                  // The whole row opens the connector's own page. The old inline
                  // panel could describe a connector but never say what it could
                  // do, because until V56 there was nowhere to store an action
                  // for a connector that had not been deployed.
                  onOpen: () => navigate(`/library/connectors/${connector.id}`),
                  actions: (
                    <>
                      <Link
                        to={`/library/connectors/${connector.id}`}
                        className="flex min-h-11 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        Edit
                      </Link>
                      {connector.status === 'DRAFT' && (
                        <button
                          onClick={() => {
                            setPageError(null)
                            publishMutation.mutate(connector.id)
                          }}
                          className="min-h-11 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setDeployError(null)
                          setDeployTarget(connector)
                        }}
                        className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-accent-teal-solid transition-colors hover:bg-muted"
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        Deploy
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError(null)
                          setPendingDelete(connector)
                        }}
                        aria-label={`Delete connector ${connector.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ),
                }))}
              />
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Live on agents</h2>
              <p className="text-sm text-muted-foreground">
                What Meta currently reports on every agent on this account. Edited on the agent that owns it.
              </p>
            </div>

            {isLoading ? (
              <LibraryTableSkeleton />
            ) : filteredRows.length === 0 ? (
              <div className="rounded-xl border border-l-4 border-l-accent-teal-solid bg-card p-6 shadow-surface-resting">
                <p className="text-base font-semibold text-foreground">
                  {connectors.length === 0 ? 'Nothing live yet' : 'Nothing matches those filters'}
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {connectors.length === 0
                    ? 'Deploy one of your connectors above, or add one from an agent’s Connectors tab.'
                    : 'Clear a filter or search for a different word to see the rest of your connectors.'}
                </p>
              </div>
            ) : (
              <LibraryTable
                itemLabel="Connector"
                showUpdated={false}
                rows={filteredRows.map((row) => ({
                  id: `${row.agentId}-${row.id}`,
                  name: row.name,
                  // Which agent it is live on — the thing you need before you
                  // can go and change it, since it is edited on the agent.
                  detail: `On ${row.agentName ?? 'Unknown agent'}`,
                  // System type / auth type / tags are real, backed by the
                  // connector mirror (agent_connector, V45).
                  tags: cardTags(row),
                  statusLabel: statusLabel(row.status),
                  statusTone: statusTone(row.status),
                  usedByCount: row.usedByAgentCount,
                  onOpen: () => navigate(`/agents/${row.agentId}?tab=connectors`),
                  actions: (
                    <Link
                      to={`/agents/${row.agentId}?tab=connectors`}
                      className="flex min-h-11 items-center rounded-md px-2 text-xs font-medium text-accent-teal-solid transition-colors hover:bg-muted"
                    >
                      Open on agent
                    </Link>
                  ),
                }))}
              />
            )}
          </section>
        </>
      )}

      {deployTarget && (
        <ConnectorDeployModal
          connector={deployTarget}
          agents={deployTargets}
          deploying={deployMutation.isPending}
          error={deployError}
          onDeploy={(agentId, secrets) => deployMutation.mutate({ id: deployTarget.id, agentId, secrets })}
          onClose={() => {
            setDeployTarget(null)
            setDeployError(null)
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          title="Delete connector"
          consequence={
            <>
              Delete <strong className="font-semibold text-foreground">{pendingDelete.name}</strong>?
              {pendingDelete.usedByAgentCount > 0 ? (
                <>
                  {' '}
                  It is deployed to{' '}
                  <strong className="font-semibold text-foreground">
                    {pendingDelete.usedByAgentCount} agent
                    {pendingDelete.usedByAgentCount === 1 ? '' : 's'}
                  </strong>
                  , which will stop being able to call it. This cannot be undone.
                </>
              ) : (
                ' No agent is using it. This cannot be undone.'
              )}
            </>
          }
          confirmLabel="Delete connector"
          isPending={deleteMutation.isPending}
          error={deleteError}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
