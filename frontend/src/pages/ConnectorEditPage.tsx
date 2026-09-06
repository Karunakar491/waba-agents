import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../lib/api'
import ErrorBanner from '../components/shared/ErrorBanner'
import StatusIndicator from '../components/shared/StatusIndicator'
import ConnectorDefinitionEditor from '../components/connectors/ConnectorDefinitionEditor'
import ActionEditor from '../components/connectors/ActionEditor'
import {
  agentFilledInputs,
  summariseAction,
  type ActionPayload,
  type ConnectorAction,
} from '../components/connectors/connectorActions'
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
 * Screen: one connector, everything about it.
 *
 * 1. USER GOAL: get this API working for my agents, and know that it works.
 * 2. EMOTIONAL STATE: unsure whether the thing they just typed is right —
 *    previously they found out only when a customer's message failed.
 * 3. POSSIBLE ACTIONS: fix the details, add or edit an action, test an action.
 * 4. HOW WE HELP: one action open at a time, four fields each, everything else
 *    behind Advanced. Test lives next to each action instead of four levels down.
 *
 * Replaces the inline editor the library page used to pop open, which could
 * describe a connector but never say what it could do — because until V56 there
 * was nowhere to store that. Meta scopes tools to a phone number, so these are
 * templates: deploying instantiates them per agent, and editing one here does
 * NOT reach into a running agent.
 */
export default function ConnectorEditPage() {
  const { connectorId } = useParams<{ connectorId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsForm, setDetailsForm] = useState<ConnectorFormValues | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [addingAction, setAddingAction] = useState(false)
  const [editingActionId, setEditingActionId] = useState<string | null>(null)

  const { data: wabas = [] } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  // There is no GET-by-id on the library, so this reads the same list the
  // library page already has cached and picks one out of it.
  const {
    data: connectors = [],
    isLoading: loadingConnector,
    error: connectorError,
  } = useQuery<LibraryConnector[]>({
    queryKey: ['connector-library', waba?.id],
    queryFn: () => api.get('/connector-library', { params: { wabaId: waba!.id } }).then((r) => r.data.data ?? []),
    enabled: !!waba,
  })
  const connector = connectors.find((c) => c.id === connectorId) ?? null

  const {
    data: actions = [],
    isLoading: loadingActions,
    error: actionsError,
  } = useQuery<ConnectorAction[]>({
    queryKey: ['connector-actions', connectorId],
    queryFn: () => api.get(`/connector-library/${connectorId}/actions`).then((r) => r.data.data ?? []),
    enabled: !!connectorId,
  })

  const saveDetails = useMutation({
    mutationFn: (values: ConnectorFormValues) =>
      api.put(`/connector-library/${connectorId}`, toRequestBody(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connector-library'] })
      setEditingDetails(false)
      setDetailsForm(null)
    },
    onError: (err: unknown) => setDetailsError(err instanceof Error ? err.message : 'Could not save.'),
  })

  const saveAction = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: ActionPayload }) =>
      id
        ? api.put(`/connector-library/${connectorId}/actions/${id}`, payload)
        : api.post(`/connector-library/${connectorId}/actions`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connector-actions', connectorId] })
      setAddingAction(false)
      setEditingActionId(null)
    },
  })

  const deleteAction = useMutation({
    mutationFn: (id: string) => api.delete(`/connector-library/${connectorId}/actions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connector-actions', connectorId] }),
  })

  if (loadingConnector) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading connector…
      </div>
    )
  }

  if (connectorError) {
    return (
      <div className="p-6">
        <ErrorBanner error={connectorError} />
      </div>
    )
  }

  if (!connector) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-base font-semibold text-foreground">That connector isn&apos;t here</p>
        <p className="max-w-md text-sm text-muted-foreground">
          It may have been deleted, or it belongs to a different WhatsApp Business Account.
        </p>
        <Link to="/library/connectors" className="text-sm font-medium text-accent-teal-solid hover:underline">
          Back to Connectors
        </Link>
      </div>
    )
  }

  const usage =
    connector.usedByAgentCount === 0
      ? 'Not used by any agent yet'
      : `Used by ${connector.usedByAgentCount} agent${connector.usedByAgentCount === 1 ? '' : 's'}`

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        to="/library/connectors"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Connectors
      </Link>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{connector.name}</h1>
          <StatusIndicator
            label={connector.status === 'PUBLISHED' ? 'Published' : 'Draft'}
            tone={connector.status === 'PUBLISHED' ? 'positive' : 'neutral'}
          />
        </div>
        <p className="text-sm text-muted-foreground">{connector.description}</p>
        <p className="text-xs text-muted-foreground">{usage}</p>
      </div>

      {/* --- Details ---------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Where it is</h2>
          {!editingDetails && (
            <button
              type="button"
              onClick={() => {
                setDetailsForm(toFormValues(connector))
                setDetailsError(null)
                setEditingDetails(true)
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {editingDetails && detailsForm ? (
          <ConnectorDefinitionEditor
            isEditing
            form={detailsForm}
            error={detailsError}
            saving={saveDetails.isPending}
            onChange={setDetailsForm}
            onSave={() => saveDetails.mutate(detailsForm)}
            onCancel={() => {
              setEditingDetails(false)
              setDetailsForm(null)
            }}
          />
        ) : (
          <dl className="grid gap-x-6 gap-y-2 rounded-xl border bg-card p-4 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Base URL</dt>
            <dd className="break-all text-foreground">{connector.baseUrl}</dd>
            <dt className="text-muted-foreground">Authentication</dt>
            <dd className="text-foreground">{connector.authType === 'NONE' ? 'None' : connector.authType}</dd>
          </dl>
        )}
      </section>

      {/* --- Actions ---------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">What it can do</h2>
            <p className="text-xs text-muted-foreground">
              Each action is one call the agent can make. Defined once here, then deployed to any agent.
            </p>
          </div>
          {!addingAction && !editingActionId && (
            <button
              type="button"
              onClick={() => {
                setAddingAction(true)
                saveAction.reset()
              }}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Add an action
            </button>
          )}
        </div>

        {actionsError ? <ErrorBanner error={actionsError} /> : null}

        {addingAction && (
          <ActionEditor
            saving={saveAction.isPending}
            error={saveAction.error}
            onSave={(payload) => saveAction.mutate({ id: null, payload })}
            onCancel={() => setAddingAction(false)}
          />
        )}

        {loadingActions ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading actions…
          </p>
        ) : actions.length === 0 && !addingAction ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium text-foreground">This connector can&apos;t do anything yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add an action so an agent has something to call. Until then, deploying it achieves nothing.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {actions.map((action) =>
              editingActionId === action.id ? (
                <li key={action.id}>
                  <ActionEditor
                    action={action}
                    saving={saveAction.isPending}
                    error={saveAction.error}
                    onSave={(payload) => saveAction.mutate({ id: action.id, payload })}
                    onCancel={() => setEditingActionId(null)}
                  />
                </li>
              ) : (
                <li key={action.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-mono text-sm text-foreground">{action.name}</p>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                    <code className="block break-all text-xs text-muted-foreground">{summariseAction(action)}</code>
                    {agentFilledInputs(action).length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        The agent works out: {agentFilledInputs(action).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingActionId(action.id)
                        saveAction.reset()
                      }}
                      aria-label={`Edit action ${action.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAction.mutate(action.id)}
                      disabled={deleteAction.isPending}
                      aria-label={`Delete action ${action.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {deleteAction.error ? <ErrorBanner error={deleteAction.error} /> : null}
      </section>

      <p className="text-xs text-muted-foreground">
        Editing this connector does not change an agent that is already running it. Deploy it again from
        Connectors when you want an agent to pick up the change.
      </p>

      <button
        type="button"
        onClick={() => navigate('/library/connectors')}
        className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        Done
      </button>
    </div>
  )
}
