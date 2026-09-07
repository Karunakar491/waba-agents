import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import api from '../lib/api'
import ErrorBanner from '../components/shared/ErrorBanner'
import ConfirmDeleteModal from '../components/shared/ConfirmDeleteModal'
import StatusIndicator from '../components/shared/StatusIndicator'
import { useActionFeedback } from '../components/shared/ActionFeedback'
import WorkbenchSidebar from '../components/connectors/workbench/WorkbenchSidebar'
import WorkbenchTabs, { type WorkbenchTab } from '../components/connectors/workbench/WorkbenchTabs'
import ToolPane from '../components/connectors/workbench/ToolPane'
import ConnectorDefinitionEditor from '../components/connectors/ConnectorDefinitionEditor'
import { type ActionPayload, type ConnectorAction } from '../components/connectors/connectorActions'
import {
  toFormValues,
  toRequestBody,
  type ConnectorFormValues,
  type LibraryConnector,
} from '../components/connectors/connectorLibrary'

interface WabaEntry {
  id: string
  label: string | null
  wabaId: string
}

/**
 * Screen: the connector workbench.
 *
 * 1. USER GOAL: get an API working for my agents, and know it works.
 * 2. EMOTIONAL STATE: technical, mid-task, comparing one endpoint against
 *    another — and previously finding out something was wrong only when a real
 *    customer's message failed.
 * 3. POSSIBLE ACTIONS: pick a connector or one of its actions, change the
 *    request, save it, test it.
 * 4. HOW WE HELP: Postman's shape, because operators already know it — a tree
 *    on the left, method and path on one bar, tabs so exactly one panel is on
 *    screen, full width.
 *
 * Organised around Meta rather than around Postman, because the two disagree
 * somewhere that matters: **auth is only ever connector-level**. A tool cannot
 * carry credentials, so a connector is itself selectable — it owns the base
 * URL, the auth and the certificate — and the tab sets differ depending on
 * whether a connector or a tool is selected. Postman lets auth sit on either
 * and would have taught the wrong model.
 *
 * This page owns navigation and data only; the panes are their own components.
 * Replaces a max-w-3xl page that used 768px of a 1440px laptop.
 */
export default function ConnectorWorkbenchPage() {
  const { connectorId, actionId } = useParams<{ connectorId: string; actionId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm } = useActionFeedback()

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    connectorId ? { [connectorId]: true } : {},
  )
  const [connectorTab, setConnectorTab] = useState('details')
  const [pendingDeleteAction, setPendingDeleteAction] = useState<ConnectorAction | null>(null)
  const [detailsForm, setDetailsForm] = useState<ConnectorFormValues | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const { data: wabas = [] } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  const {
    data: connectors = [],
    isLoading: loadingConnectors,
    error: connectorsError,
  } = useQuery<LibraryConnector[]>({
    queryKey: ['connector-library', waba?.id],
    queryFn: () =>
      api.get('/connector-library', { params: { wabaId: waba!.id } }).then((r) => r.data.data ?? []),
    enabled: !!waba,
  })

  // One query per expanded connector, so the tree fills in as it is opened
  // rather than fetching every connector's actions up front.
  const expandedIds = useMemo(
    () => connectors.filter((c) => expanded[c.id]).map((c) => c.id),
    [connectors, expanded],
  )
  const actionQueries = useQueries({
    queries: expandedIds.map((id) => ({
      queryKey: ['connector-actions', id],
      queryFn: () => api.get(`/connector-library/${id}/actions`).then((r) => r.data.data ?? []),
    })),
  })
  const actionsByConnector = useMemo(() => {
    const map: Record<string, ConnectorAction[] | undefined> = {}
    expandedIds.forEach((id, i) => {
      map[id] = actionQueries[i]?.data as ConnectorAction[] | undefined
    })
    return map
  }, [expandedIds, actionQueries])

  const connector = connectors.find((c) => c.id === connectorId) ?? null
  const actions = connectorId ? actionsByConnector[connectorId] : undefined
  const action = actionId && actionId !== 'new' ? actions?.find((a) => a.id === actionId) ?? null : null

  const saveAction = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: ActionPayload }) =>
      id
        ? api.put(`/connector-library/${connectorId}/actions/${id}`, payload)
        : api.post(`/connector-library/${connectorId}/actions`, payload),
    onSuccess: (res, { id, payload }) => {
      void queryClient.invalidateQueries({ queryKey: ['connector-actions', connectorId] })
      // Says plainly that saving is not the same as the agent being able to call
      // it — nothing instantiates these on Meta yet.
      confirm(
        id ? 'Action saved' : 'Action added',
        `${payload.name} — deploy this connector to an agent to make it callable`,
      )
      if (!id) {
        const newId = (res as { data?: { data?: { id?: string } } })?.data?.data?.id
        if (newId) navigate(`/library/connectors/${connectorId}/actions/${newId}`, { replace: true })
      }
    },
  })

  const deleteAction = useMutation({
    mutationFn: (id: string) => api.delete(`/connector-library/${connectorId}/actions/${id}`),
    onSuccess: (_d, id) => {
      const gone = actions?.find((a) => a.id === id)?.name
      void queryClient.invalidateQueries({ queryKey: ['connector-actions', connectorId] })
      setPendingDeleteAction(null)
      confirm('Action deleted', gone)
      navigate(`/library/connectors/${connectorId}`, { replace: true })
    },
  })

  const saveDetails = useMutation({
    mutationFn: (values: ConnectorFormValues) =>
      api.put(`/connector-library/${connectorId}`, toRequestBody(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['connector-library'] })
      setDetailsForm(null)
      confirm('Connector details saved')
    },
    onError: (err: unknown) =>
      setDetailsError(err instanceof Error ? err.message : 'Could not save.'),
  })

  if (loadingConnectors) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading connectors…
      </div>
    )
  }
  if (connectorsError) {
    return (
      <div className="p-6">
        <ErrorBanner error={connectorsError} />
      </div>
    )
  }

  const connectorTabs: WorkbenchTab[] = [
    { id: 'details', label: 'Details' },
    { id: 'auth', label: 'Auth' },
    { id: 'deployments', label: 'Deployments', count: connector?.usedByAgentCount ?? 0 },
  ]

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
        <Link
          to="/library/connectors"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Connectors
        </Link>
        {connector && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate text-sm font-medium text-foreground">{connector.name}</span>
            <StatusIndicator
              label={connector.status === 'PUBLISHED' ? 'Published' : 'Draft'}
              tone={connector.status === 'PUBLISHED' ? 'positive' : 'neutral'}
            />
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <WorkbenchSidebar
          connectors={connectors}
          actionsByConnector={actionsByConnector}
          selectedConnectorId={connectorId ?? null}
          selectedActionId={actionId ?? null}
          expanded={expanded}
          onToggleExpand={(id) => setExpanded((p) => ({ ...p, [id]: !p[id] }))}
          onSelectConnector={(id) => {
            setExpanded((p) => ({ ...p, [id]: true }))
            navigate(`/library/connectors/${id}`)
          }}
          onSelectAction={(cid, aid) => navigate(`/library/connectors/${cid}/actions/${aid}`)}
          onNewConnector={() => navigate('/library/connectors')}
          onNewAction={(cid) => {
            setExpanded((p) => ({ ...p, [cid]: true }))
            navigate(`/library/connectors/${cid}/actions/new`)
          }}
        />

        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {!connector ? (
            <p className="text-sm text-muted-foreground">
              Pick a connector on the left, or{' '}
              <Link to="/library/connectors" className="text-accent-teal-solid hover:underline">
                go back to the list
              </Link>
              .
            </p>
          ) : actionId && actionId !== 'new' && actions === undefined ? (
            /* The pane fills its fields once, at mount, from the action it is
               given. So it must not mount before the action has arrived —
               reloading a tool's URL used to show an empty form, because the
               actions query resolves after the first render and the pane kept
               its blank draft. Caught by the browser test, not by looking. */
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading action…
            </p>
          ) : actionId && actionId !== 'new' && !action ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">That action isn&apos;t here</p>
              <p className="text-sm text-muted-foreground">
                It may have been deleted. Pick another on the left.
              </p>
            </div>
          ) : actionId ? (
            <ToolPane
              // Remounts on a different action, which resets the draft — see
              // ToolPane's note on why that is a key and not an effect.
              key={actionId}
              action={action}
              baseUrl={connector.baseUrl}
              saving={saveAction.isPending}
              saveError={saveAction.error}
              onSave={(payload) => saveAction.mutate({ id: action?.id ?? null, payload })}
              onRequestDelete={() => action && setPendingDeleteAction(action)}
            />
          ) : (
            <div className="space-y-4">
              <WorkbenchTabs tabs={connectorTabs} active={connectorTab} onSelect={setConnectorTab} />

              {connectorTab === 'details' && (
                <div className="max-w-3xl">
                  <ConnectorDefinitionEditor
                    isEditing
                    form={detailsForm ?? toFormValues(connector)}
                    error={detailsError}
                    saving={saveDetails.isPending}
                    onChange={setDetailsForm}
                    onSave={() => saveDetails.mutate(detailsForm ?? toFormValues(connector))}
                    onCancel={() => {
                      setDetailsForm(null)
                      setDetailsError(null)
                    }}
                  />
                </div>
              )}

              {connectorTab === 'auth' && (
                <div className="max-w-3xl space-y-2 rounded-xl border bg-card p-4">
                  <p className="text-sm font-medium text-foreground">
                    Authentication lives on the connector
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Meta holds credentials against the connector, not against each action — so
                    every action here shares one set. Two endpoints on the same API needing
                    different keys are two connectors.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Editable on the Details tab for now. Multiple API-key headers, query and body
                    credentials, the mTLS certificate and per-user OAuth are the next thing being
                    built.
                  </p>
                </div>
              )}

              {connectorTab === 'deployments' && (
                <div className="max-w-3xl space-y-2">
                  {connector.deployments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Not deployed to any agent yet, so nothing here can be called.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-xl border bg-card">
                      {connector.deployments.map((d) => (
                        <li
                          key={`${d.agentId}-${d.status}`}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                        >
                          <span className="truncate text-foreground">{d.agentName ?? d.agentId}</span>
                          <StatusIndicator
                            label={d.status === 'OUT_OF_SYNC' ? 'Behind — redeploy' : 'Up to date'}
                            tone={d.status === 'OUT_OF_SYNC' ? 'warning' : 'positive'}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {pendingDeleteAction && (
        <ConfirmDeleteModal
          title="Delete action"
          consequence={
            <>
              Delete{' '}
              <strong className="font-semibold text-foreground">{pendingDeleteAction.name}</strong>?
              Agents already running this connector keep the copy they were deployed with until you
              deploy it again. This cannot be undone.
            </>
          }
          confirmLabel="Delete action"
          isPending={deleteAction.isPending}
          error={deleteAction.error instanceof Error ? deleteAction.error.message : null}
          onConfirm={() => deleteAction.mutate(pendingDeleteAction.id)}
          onClose={() => setPendingDeleteAction(null)}
        />
      )}
    </div>
  )
}
