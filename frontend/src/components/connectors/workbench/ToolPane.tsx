import { useMemo, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import ErrorBanner from '../../shared/ErrorBanner'
import RequestBar from './RequestBar'
import WorkbenchTabs, { type WorkbenchTab } from './WorkbenchTabs'
import AutoHeaders from './AutoHeaders'
import ResponsePane, { type ProbeResult } from './ResponsePane'
import ToolParamsEditor from '../../agent-detail/ToolParamsEditor'
import ToolBodyEditor from '../../agent-detail/ToolBodyEditor'
import {
  buildRequestDefinition,
  parseRequestDefinition,
  extractPathParamNames,
  methodSendsBody,
  IncompleteRowError,
  type ParamRow,
  type BodyFieldRow,
} from '../../agent-detail/toolRequestDefinition'
import type { ActionPayload, ConnectorAction } from '../connectorActions'

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition'

/**
 * What Send posts. Mirrors the backend's ProbeRequest, with `secrets` separate
 * from `headers` for the same reason it is separate there: it is the one field
 * nothing may persist.
 */
export interface ProbeRequestPayload {
  method: string
  path: string
  queryParams: Record<string, string>
  headers: Record<string, string>
  secrets: Record<string, string>
  body?: string
}

/**
 * One action, laid out like a Postman request: name, the method+path bar, then
 * Params / Authorization / Headers / Body / Docs / Response.
 *
 * The name and description used to sit above the bar as two labelled prose
 * fields, which pushed the bar down the page and made this look like a form
 * rather than a request. The name is now the title, and the description lives
 * in Docs — Postman's own home for it. It is still required, and the "Still
 * needed" line beside Save says which tab it is on, because a required field
 * behind a tab is otherwise a dead button with no explanation.
 *
 * Keyed by the caller on the action's id, so switching actions in the sidebar
 * remounts this and resets the draft. That is deliberately not an effect —
 * syncing props into state on every refetch of the actions list would fight the
 * user's typing, and this project has already shipped one stale-effect-deps bug.
 */
export default function ToolPane({
  action,
  baseUrl,
  authLabel,
  authHeaders,
  saving,
  saveError,
  onSave,
  onRequestDelete,
  onOpenConnectorAuth,
  onSend,
  probe,
}: {
  /** Null when adding a new action. */
  action: ConnectorAction | null
  baseUrl: string
  /** The connector's auth type, in words — this action inherits it. */
  authLabel: string
  /** Credential header names from the connector, sent without being typed here. */
  authHeaders: string[]
  saving: boolean
  saveError: unknown
  onSave: (payload: ActionPayload) => void
  onRequestDelete: () => void
  onOpenConnectorAuth: () => void
  /** Sends the request as it stands, saved or not — that is the point of it. */
  onSend: (payload: ProbeRequestPayload) => void
  probe: { result: ProbeResult | null; error: string | null; pending: boolean }
}) {
  const prefill = useMemo(
    () => (action ? parseRequestDefinition(action.requestDefinition) : null),
    [action],
  )

  const [tab, setTab] = useState('params')
  const [name, setName] = useState(action?.name ?? '')
  const [description, setDescription] = useState(action?.description ?? '')
  const [method, setMethod] = useState(prefill?.method ?? 'GET')
  const [path, setPath] = useState(prefill?.path ?? '/')
  const [queryParams, setQueryParams] = useState<ParamRow[]>(prefill?.queryParams ?? [])
  const [headerParams, setHeaderParams] = useState<ParamRow[]>(prefill?.headerParams ?? [])
  const [bodyFields, setBodyFields] = useState<BodyFieldRow[]>(prefill?.bodyFields ?? [])
  const [pathParamMeta, setPathParamMeta] = useState<Record<string, ParamRow>>(
    Object.fromEntries((prefill?.pathParams ?? []).map((row) => [row.key, row])),
  )
  const [rowError, setRowError] = useState<string | null>(null)

  /**
   * Credential values, for this call only.
   *
   * They have to be typed here because the product deliberately never stores
   * them — they are entered at publish time and go straight to Meta. So a test
   * call has no credential to reuse, and the honest thing is to ask for it,
   * say it is not being saved, and mean it: this is component state, it dies
   * with the component, and the server that receives it writes it nowhere.
   */
  const [secrets, setSecrets] = useState<Record<string, string>>({})

  /** Body to send, as JSON text. Separate from the field table: the table
   *  describes the shape for the agent, a test needs actual values. */
  const [probeBody, setProbeBody] = useState('')

  // Derived from the Path field each render rather than synced in an effect.
  const pathTokens = extractPathParamNames(path)
  const pathParamRows: ParamRow[] = pathTokens.map(
    (token) =>
      pathParamMeta[token] ?? {
        key: token,
        type: 'string',
        description: '',
        required: true,
        fill: 'agent',
        fixedValue: '',
      },
  )
  function setPathParamRows(updater: (prev: ParamRow[]) => ParamRow[]) {
    const next = updater(pathParamRows)
    setPathParamMeta((prev) => {
      const merged = { ...prev }
      for (const row of next) merged[row.key] = row
      return merged
    })
  }

  const bodyAllowed = methodSendsBody(method)

  const tabs: WorkbenchTab[] = [
    { id: 'params', label: 'Params', count: pathParamRows.length + queryParams.length },
    { id: 'auth', label: 'Authorization' },
    { id: 'headers', label: 'Headers', count: headerParams.length },
    {
      id: 'body',
      label: 'Body',
      count: bodyAllowed ? bodyFields.length : undefined,
      unavailable: bodyAllowed
        ? null
        : 'A GET request sends no body — Meta drops it, so configuring one here would lie.',
    },
    { id: 'docs', label: 'Docs', filled: !!description.trim() },
    { id: 'response', label: 'Response', filled: !!probe.result },
  ]

  /**
   * Why Send is refused, or null when it can go.
   *
   * Deliberately shorter than the list Save needs: a name and a description are
   * required to save an action, but neither affects the HTTP call, and refusing
   * to send until they are filled would make testing the last step instead of
   * the first.
   */
  const sendUnavailable = !path.trim() ? 'Add a path first.' : null

  function handleSend() {
    const query: Record<string, string> = {}
    for (const row of queryParams) {
      // Only rows with a value of their own. A row the agent fills has no value
      // to send here, and sending an empty one would test a different request.
      if (row.key.trim() && row.fill === 'fixed' && row.fixedValue.trim()) {
        query[row.key.trim()] = row.fixedValue
      }
    }

    const headers: Record<string, string> = {}
    for (const row of headerParams) {
      if (row.key.trim() && row.fill === 'fixed' && row.fixedValue.trim()) {
        headers[row.key.trim()] = row.fixedValue
      }
    }
    if (bodyAllowed && probeBody.trim()) headers['Content-Type'] = 'application/json'

    // Path tokens have to be real values, not {braces}, or the API sees a
    // literal placeholder and 404s in a way that looks like our bug.
    let resolvedPath = path.trim()
    for (const row of pathParamRows) {
      if (row.fill === 'fixed' && row.fixedValue.trim()) {
        resolvedPath = resolvedPath.replace(`{${row.key}}`, encodeURIComponent(row.fixedValue))
      }
    }

    onSend({
      method,
      path: resolvedPath,
      queryParams: query,
      headers,
      secrets,
      body: bodyAllowed && probeBody.trim() ? probeBody : undefined,
    })
    setTab('response')
  }

  const unresolvedTokens = pathTokens.filter(
    (token) => !pathParamMeta[token]?.fixedValue?.trim(),
  )

  const stillNeeded = [
    !name.trim() && 'Name',
    !description.trim() && 'Description (Docs tab)',
    !path.trim() && 'Path',
  ].filter(Boolean) as string[]

  function handleSave() {
    setRowError(null)
    let requestDefinition
    try {
      requestDefinition = buildRequestDefinition({
        method,
        path: path.trim(),
        pathParams: pathParamRows,
        queryParams,
        headerParams,
        bodyFields,
      })
    } catch (err) {
      // A blank row is a visible failure, never a silently dropped field.
      setRowError(err instanceof IncompleteRowError ? err.message : 'Check the parameter rows.')
      return
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      requestDefinition,
      userAuthRequired: false,
    })
  }

  return (
    <div className="space-y-4">
      {/* The request's name.

          It was borderless with only a placeholder, "editable in place" like
          Postman's request title. On an empty action that rendered as a line of
          large grey ghost text with no field around it — it read as a broken
          heading, not as something to type in. A label and a border cost one
          line and remove the guessing. */}
      <label className="block max-w-lg space-y-1">
        <span className="block text-xs font-medium text-foreground">Name</span>
        <input
          type="text"
          value={name}
          disabled={saving}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. product_search"
          spellCheck={false}
          className={`${inputCls} font-mono`}
        />
      </label>

      <RequestBar
        method={method}
        path={path}
        baseUrl={baseUrl}
        disabled={saving}
        onMethodChange={setMethod}
        onPathChange={setPath}
        onSend={handleSend}
        sending={probe.pending}
        sendUnavailable={sendUnavailable}
      />

      <WorkbenchTabs tabs={tabs} active={tab} onSelect={setTab} />

      <div className="pt-1">
        {tab === 'params' && (
          /* Query first, then path — Postman's order, and the order they are
             usually edited in: path rows appear on their own as soon as a
             {token} is typed into the bar. */
          <div className="space-y-4">
            <ToolParamsEditor
              label="Query parameters"
              rows={queryParams}
              setRows={setQueryParams}
              disabled={saving}
            />
            {pathTokens.length > 0 && (
              <ToolParamsEditor
                label="Path parameters"
                rows={pathParamRows}
                setRows={setPathParamRows}
                lockedKeys={pathTokens}
                showAdd={false}
                disabled={saving}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Query and path values are single values only — Meta rejects an object or a list
              here. Nested shapes belong in the body.
            </p>
          </div>
        )}

        {tab === 'auth' && (
          /* Postman calls this "inherit auth from parent" and offers to
             override it per request. Meta does not: auth_config lives on the
             connector and a tool cannot carry a credential. So the tab exists
             — a missing one sends people hunting — and it reports rather than
             edits, with the way to change it one click away. */
          <div className="max-w-2xl space-y-2 text-sm">
            <p className="text-foreground">
              Inherited from the connector: <span className="font-medium">{authLabel}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Meta keeps <code>auth_config</code> on the connector, so every action under it signs
              in the same way and no action can override it. Credential values are typed at publish
              time and never stored here.
            </p>
            <button
              type="button"
              onClick={onOpenConnectorAuth}
              className="min-h-11 text-xs font-medium text-accent-teal-solid transition-colors hover:underline"
            >
              Change it on the connector
            </button>

            {/* The one place a credential value is typed outside publishing.
                It is here rather than on the Response tab because this is where
                someone looks when a call comes back 401. */}
            {authHeaders.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-foreground">
                  Credential values for sending a test request
                </p>
                <p className="text-xs text-muted-foreground">
                  Needed because nothing here stores them. Typed for this call only — not saved,
                  not sent to Meta, gone when you leave this page.
                </p>
                {authHeaders.map((header) => (
                  <label key={header} className="block max-w-md space-y-1">
                    <span className="block font-mono text-xs text-muted-foreground">{header}</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={secrets[header] ?? ''}
                      onChange={(e) =>
                        setSecrets((prev) => ({ ...prev, [header]: e.target.value }))
                      }
                      placeholder="Paste the value to test with"
                      className={`${inputCls} font-mono`}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'headers' && (
          <div className="space-y-4">
            <ToolParamsEditor
              label="Headers"
              rows={headerParams}
              setRows={setHeaderParams}
              disabled={saving}
            />
            <AutoHeaders authHeaders={authHeaders} />
          </div>
        )}

        {tab === 'body' && bodyAllowed && (
          <ToolBodyEditor rows={bodyFields} setRows={setBodyFields} disabled={saving} />
        )}

        {tab === 'docs' && (
          <label className="block max-w-2xl space-y-1.5">
            {/* Stated as behaviour, not documentation: this sentence is what
                the agent reads to decide when to call the action, and vague
                wording here is the main cause of an agent calling the wrong
                thing. That is also why it is required. */}
            <span className="block text-xs font-medium text-foreground">
              Description — the agent reads this to decide when to call this action
            </span>
            <textarea
              rows={4}
              value={description}
              disabled={saving}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Search the catalogue for what the buyer asked for"
              className={`${inputCls} resize-y`}
            />
            <span className="block text-xs text-muted-foreground">
              Required. Meta passes it to the model verbatim.
            </span>
          </label>
        )}

        {tab === 'response' && (
          <div className="space-y-4">
            {/* Actual values to send, which is a different thing from the Body
                tab's field table: that table tells the agent what shape to
                build, and a shape cannot be sent. */}
            {bodyAllowed && (
              <label className="block max-w-2xl space-y-1">
                <span className="block text-xs font-medium text-foreground">
                  Body for this call
                </span>
                <textarea
                  rows={5}
                  value={probeBody}
                  onChange={(e) => setProbeBody(e.target.value)}
                  placeholder={'{\n  "query": "biryani",\n  "city": "Delhi"\n}'}
                  spellCheck={false}
                  className={`${inputCls} resize-y font-mono`}
                />
                <span className="block text-xs text-muted-foreground">
                  Real values, not the field shapes on the Body tab. Sent as
                  <code className="mx-1">application/json</code>.
                </span>
              </label>
            )}

            {unresolvedTokens.length > 0 && (
              <p className="max-w-2xl text-xs text-warning">
                {unresolvedTokens.map((t) => `{${t}}`).join(', ')} has no value, so it will be sent
                literally and the API will most likely reject it. Give it a fixed value on the
                Params tab to test with.
              </p>
            )}

            <ResponsePane result={probe.result} error={probe.error} />
          </div>
        )}
      </div>

      {rowError && <p className="text-xs text-destructive">{rowError}</p>}
      {saveError ? <ErrorBanner error={saveError} /> : null}

      <div className="flex items-center gap-3 border-t pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={stillNeeded.length > 0 || saving}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-accent-teal-solid px-4 text-sm
            font-semibold text-white transition-opacity hover:opacity-90
            disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {action ? 'Save action' : 'Add action'}
        </button>
        {/* Says what is missing instead of leaving a dead button. */}
        {stillNeeded.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Still needed: <span className="text-foreground">{stillNeeded.join(', ')}</span>
          </span>
        )}
        {action && (
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`Delete action ${action.name}`}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg border
              text-muted-foreground transition hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
