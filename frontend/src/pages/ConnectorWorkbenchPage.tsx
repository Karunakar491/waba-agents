import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import api from '../lib/api'
import ErrorBanner from '../components/shared/ErrorBanner'
import ConfirmDeleteModal from '../components/shared/ConfirmDeleteModal'
import StatusIndicator from '../components/shared/StatusIndicator'
import { useActionFeedback } from '../components/shared/ActionFeedback'
import WorkbenchSidebar from '../components/connectors/workbench/WorkbenchSidebar'
import ToolPane from '../components/connectors/workbench/ToolPane'
import ConnectorPane from '../components/connectors/workbench/ConnectorPane'
import { type WorkbenchTab } from '../components/connectors/workbench/WorkbenchTabs'
import { META_MACROS } from '../components/connectors/workbench/metaMacros'
import ConnectorDeployModal, { type DeployTargetAgent } from '../components/connectors/ConnectorDeployModal'
import { type ActionPayload, type ConnectorAction } from '../components/connectors/connectorActions'
import ConnectorDefinitionEditor from '../components/connectors/ConnectorDefinitionEditor'
import type { ConnectorRow } from '../components/connectors/ConnectorsTable'
import {
  AUTH_TYPES,
  EMPTY_CONNECTOR_FORM,
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
 *    on the left, method and path on one bar, full width.
 *
 * Organised around Meta rather than around Postman, because the two disagree
 * somewhere that matters: **auth is only ever connector-level**. A tool cannot
 * carry credentials, so a connector is itself selectable — it owns the base
 * URL, the auth and the certificate. Postman lets auth sit on either and would
 * have taught the wrong model.
 *
 * Both levels are tabbed, mapped onto Postman's own two levels: a connector is
 * a collection (Actions / Details / Authorization / Variables / Agents), an
 * action is a request (Params / Authorization / Headers / Body / Docs /
 * Response). The panes carry the notes on what was deliberately not copied —
 * collection-level headers and bodies, scripts, settings.
 *
 * An action's Authorization tab reports rather than edits, which is the one
 * place the mapping is not one-to-one: Postman lets a request override its
 * parent's auth, Meta does not.
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
  const [pendingDeleteAction, setPendingDeleteAction] = useState<ConnectorAction | null>(null)
  const [detailsForm, setDetailsForm] = useState<ConnectorFormValues | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [publishTarget, setPublishTarget] = useState<LibraryConnector | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const creating = connectorId === 'new'
  const [newForm, setNewForm] = useState<ConnectorFormValues>(EMPTY_CONNECTOR_FORM)
  const [newError, setNewError] = useState<string | null>(null)
  const [pendingDeleteConnector, setPendingDeleteConnector] = useState<LibraryConnector | null>(null)
  const [deleteConnectorError, setDeleteConnectorError] = useState<string | null>(null)

  /**
   * Which of the connector's sections is showing, in the URL rather than in
   * state.
   *
   * It has to be. `/library/connectors/:id` and
   * `/library/connectors/:id/actions/:actionId` are separate routes, so moving
   * between them unmounts this page and remounts it — held in `useState`, the
   * section silently reverted to Details on the way back from an action, and
   * the test caught it showing the wrong panel.
   *
   * Details is the default: arriving at a connector, the connector is what you
   * are looking at. Actions led with a table that is empty on every connector
   * just created.
   */
  const [searchParams] = useSearchParams()
  const connectorTab = searchParams.get('section') ?? 'details'

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

  // Only agents on this WABA with a number bound can receive a connector.
  const { data: agentList = [] } = useQuery<
    { id: string; displayName: string; phoneNumberId: string | null; wabaId: string | null }[]
  >({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data.data ?? []),
  })
  const publishTargets: DeployTargetAgent[] = useMemo(
    () =>
      agentList
        .filter((a) => !waba || a.wabaId === waba.id)
        .map((a) => ({ id: a.id, displayName: a.displayName, phoneNumberId: a.phoneNumberId })),
    [agentList, waba],
  )

  const publishMutation = useMutation({
    mutationFn: ({ id, agentId, secrets }: { id: string; agentId: string; secrets: Record<string, string> }) =>
      api.post(`/connector-library/${id}/deploy`, { agentId, secrets }),
    onSuccess: (_d, { agentId }) => {
      void queryClient.invalidateQueries({ queryKey: ['connector-library'] })
      const agent = agentList.find((a) => a.id === agentId)
      setPublishTarget(null)
      setPublishError(null)
      confirm('Published to Meta', `${publishTarget?.name ?? 'Connector'} → ${agent?.displayName ?? 'the agent'}`)
    },
    onError: (err: unknown) =>
      setPublishError(err instanceof Error ? err.message : 'Could not publish.'),
  })

  /**
   * What Meta reports on the account's agents. Used only to show, at the
   * bottom of the tree, connectors that exist on an agent but have no
   * definition of ours — added directly on the agent, or before this library
   * existed. They used to be a second table on a separate page.
   */
  const { data: mirror = [] } = useQuery<ConnectorRow[]>({
    queryKey: ['library-connectors', waba?.id],
    queryFn: () =>
      api
        .get('/connectors', { params: { wabaId: waba!.id } })
        .then((r) => r.data.data?.connectors ?? []),
    enabled: !!waba,
  })
  const liveOnly = useMemo(() => {
    const ours = new Set(connectors.map((c) => c.name.toLowerCase()))
    return mirror
      .filter((row) => !ours.has((row.name ?? '').toLowerCase()))
      .map((row) => ({
        key: `${row.agentId}-${row.id}`,
        name: row.name,
        agentId: row.agentId,
        agentName: row.agentName,
      }))
  }, [mirror, connectors])

  const createConnector = useMutation({
    mutationFn: (values: ConnectorFormValues) =>
      api.post('/connector-library', { wabaId: waba!.id, ...toRequestBody(values) }),
    onSuccess: (res, values) => {
      void queryClient.invalidateQueries({ queryKey: ['connector-library'] })
      confirm('Connector saved', `${values.name} — add an action so an agent can call it`)
      setNewForm(EMPTY_CONNECTOR_FORM)
      setNewError(null)
      const id = (res as { data?: { data?: { id?: string } } })?.data?.data?.id
      if (id) navigate(`/library/connectors/${id}`, { replace: true })
    },
    onError: (err: unknown) =>
      setNewError(err instanceof Error ? err.message : 'Could not save.'),
  })

  const deleteConnector = useMutation({
    mutationFn: (id: string) => api.delete(`/connector-library/${id}`),
    onSuccess: (_d, id) => {
      const gone = connectors.find((c) => c.id === id)?.name
      void queryClient.invalidateQueries({ queryKey: ['connector-library'] })
      setPendingDeleteConnector(null)
      confirm('Connector deleted', gone)
      navigate('/library/connectors', { replace: true })
    },
    onError: (err: unknown) =>
      setDeleteConnectorError(err instanceof Error ? err.message : 'Could not delete.'),
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

  /**
   * The connector's sections, and what selecting one does.
   *
   * Actions is the odd one: on a connector with no actions it opens the
   * request editor straight away ("add an action is always an extra step"),
   * and from inside an action it goes back to the connector to show the table.
   */
  const connectorSections: WorkbenchTab[] = [
    { id: 'actions', label: 'Actions', count: actions?.length ?? 0 },
    { id: 'details', label: 'Details' },
    { id: 'auth', label: 'Authorization' },
    { id: 'variables', label: 'Variables', count: META_MACROS.length },
    { id: 'agents', label: 'Agents', count: connector?.deployments.length ?? 0 },
  ]

  function selectConnectorSection(id: string) {
    // One navigation covers every case: choosing a section from the connector,
    // and leaving an open action for one of them. Whether Actions means "the
    // table" or "the editor" is decided below, once the actions are known —
    // deciding it here read `actions?.length === 0` before the query had
    // answered, so a click during loading landed on an empty table.
    navigate(`/library/connectors/${connectorId}?section=${id}`)
  }

  /**
   * Actions on a connector with none IS the request editor — "add an action is
   * always an extra step". Done here rather than on the click because it needs
   * the actions to have loaded, and it covers a pasted `?section=actions` URL
   * too. `replace` so Back does not bounce off it.
   */
  useEffect(() => {
    if (actionId || connectorTab !== 'actions' || !connectorId) return
    if (actions && actions.length === 0) {
      navigate(`/library/connectors/${connectorId}/actions/new`, { replace: true })
    }
  }, [actionId, connectorTab, connectorId, actions, navigate])

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

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* One line, and only ever ONE row of tabs on the screen.

          The connector's sections were a second tab row under this, so an open
          action put two strips on screen — with "Authorization" and "Headers"
          appearing twice. They belong at breadcrumb level: small muted links on
          the same line as the name, plainly navigation rather than a tab strip,
          and still reachable from inside an action. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-card px-4 py-2.5">
        <Link
          to="/library/connectors"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Connectors
        </Link>
        {connector && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="max-w-xs truncate text-sm font-medium text-foreground">
              {connector.name}
            </span>
            <StatusIndicator
              label={connector.status === 'PUBLISHED' ? 'Published' : 'Draft'}
              tone={connector.status === 'PUBLISHED' ? 'positive' : 'neutral'}
            />

            <nav aria-label="Connector sections" className="ml-auto flex items-center gap-1">
              {connectorSections.map((section) => {
                const current = (actionId ? 'actions' : connectorTab) === section.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => selectConnectorSection(section.id)}
                    className={
                      'rounded-md px-2 py-1 text-xs transition-colors ' +
                      (current
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {section.label}
                    {typeof section.count === 'number' && section.count > 0 && (
                      <span className="ml-1 tabular-nums text-muted-foreground">
                        {section.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
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
          liveOnly={liveOnly}
          onOpenOnAgent={(agentId) => navigate(`/agents/${agentId}?tab=connectors`)}
          onNewConnector={() => navigate('/library/connectors/new')}
          onNewAction={(cid) => {
            setExpanded((p) => ({ ...p, [cid]: true }))
            navigate(`/library/connectors/${cid}/actions/new`)
          }}
        />

        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {creating ? (
            <div className="max-w-3xl space-y-3">
              <h2 className="text-sm font-semibold text-foreground">New connector</h2>
              <ConnectorDefinitionEditor
                isEditing={false}
                form={newForm}
                error={newError}
                saving={createConnector.isPending}
                onChange={setNewForm}
                onSave={() => createConnector.mutate(newForm)}
                onCancel={() => navigate('/library/connectors')}
              />
            </div>
          ) : !connector ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {connectors.length === 0 ? 'No connectors yet' : 'Pick a connector on the left'}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                A connector is an API your agents can call. Everything on this account is in the
                panel on the left — there is no second list.
              </p>
              <button
                type="button"
                onClick={() => navigate('/library/connectors/new')}
                className="mt-1 flex min-h-11 items-center gap-1.5 rounded-lg bg-accent-teal-solid px-4
                  text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                New connector
              </button>
            </div>
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
              authLabel={
                AUTH_TYPES.find((a) => a.value === connector.authType)?.label ?? connector.authType
              }
              authHeaders={toFormValues(connector)
                .headers.map((h) => h.fieldName.trim())
                .filter(Boolean)}
              saving={saveAction.isPending}
              saveError={saveAction.error}
              onSave={(payload) => saveAction.mutate({ id: action?.id ?? null, payload })}
              onRequestDelete={() => action && setPendingDeleteAction(action)}
              onOpenConnectorAuth={() => selectConnectorSection('auth')}
            />
          ) : (
            <ConnectorPane
              connector={connector}
              actions={actions}
              form={detailsForm ?? toFormValues(connector)}
              detailsError={detailsError}
              saving={saveDetails.isPending}
              onFormChange={setDetailsForm}
              onSave={() => saveDetails.mutate(detailsForm ?? toFormValues(connector))}
              onResetForm={() => {
                setDetailsForm(null)
                setDetailsError(null)
              }}
              onOpenAction={(aid) =>
                navigate(`/library/connectors/${connector.id}/actions/${aid}`)
              }
              onAddAction={() => navigate(`/library/connectors/${connector.id}/actions/new`)}
              onPublish={() => {
                setPublishError(null)
                setPublishTarget(connector)
              }}
              onRequestDelete={() => {
                setDeleteConnectorError(null)
                setPendingDeleteConnector(connector)
              }}
              tab={connectorTab}
            />
          )}
        </div>
      </div>

      {pendingDeleteConnector && (
        <ConfirmDeleteModal
          title="Delete connector"
          consequence={
            <>
              Delete{' '}
              <strong className="font-semibold text-foreground">
                {pendingDeleteConnector.name}
              </strong>
              ? No agent is using it, so nothing stops working. Its actions go with it, and this
              cannot be undone.
            </>
          }
          confirmLabel="Delete connector"
          isPending={deleteConnector.isPending}
          error={deleteConnectorError}
          onConfirm={() => deleteConnector.mutate(pendingDeleteConnector.id)}
          onClose={() => setPendingDeleteConnector(null)}
        />
      )}

      {publishTarget && (
        <ConnectorDeployModal
          connector={publishTarget}
          agents={publishTargets}
          deploying={publishMutation.isPending}
          error={publishError}
          onDeploy={(agentId, secrets) =>
            publishMutation.mutate({ id: publishTarget.id, agentId, secrets })
          }
          onClose={() => {
            setPublishTarget(null)
            setPublishError(null)
          }}
        />
      )}

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
