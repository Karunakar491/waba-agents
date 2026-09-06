import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import ToolParamsEditor from '../agent-detail/ToolParamsEditor'
import ToolBodyEditor from '../agent-detail/ToolBodyEditor'
import {
  buildRequestDefinition,
  parseRequestDefinition,
  extractPathParamNames,
  methodSendsBody,
  buildPreviewUrl,
  IncompleteRowError,
  type ParamRow,
  type BodyFieldRow,
} from '../agent-detail/toolRequestDefinition'
import { HTTP_METHODS, type ActionPayload, type ConnectorAction } from './connectorActions'
import ErrorBanner from '../shared/ErrorBanner'

const inputCls =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition'

/**
 * Screen: Connector edit page — one action.
 *
 * Four things are visible: what it does, the method and path, what the agent
 * sends, and the resulting call. Everything else — headers, fixed values,
 * macros, nested bodies — sits under Advanced and stays shut.
 *
 * That split is deliberate. An earlier draft of this design put request,
 * response and mapping on screen at once; the founder's correction was that a
 * page holding several complex panels is harder to use than a few hidden ones,
 * not easier.
 *
 * The request editors are the same components the per-agent tool modal uses, so
 * the two paths cannot drift into disagreeing about what Meta accepts.
 */
export default function ActionEditor({
  action,
  saving,
  error,
  onSave,
  onCancel,
}: {
  /** undefined = adding a new action. */
  action?: ConnectorAction
  saving: boolean
  error: unknown
  onSave: (payload: ActionPayload) => void
  onCancel: () => void
}) {
  const prefill = action ? parseRequestDefinition(action.requestDefinition) : null

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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  // Derived fresh every render from the Path field rather than synced in an
  // effect — this project has already shipped one stale-effect-deps bug.
  const pathTokens = extractPathParamNames(path)
  const pathParamRows: ParamRow[] = pathTokens.map(
    (token) =>
      pathParamMeta[token] ?? { key: token, type: 'string', description: '', required: true, fill: 'agent', fixedValue: '' },
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
  const canSave = !!name.trim() && !!description.trim() && !!path.trim() && !saving

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
    onSave({ name: name.trim(), description: description.trim(), requestDefinition, userAuthRequired: false })
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <label htmlFor="action-name" className="block text-xs font-medium text-foreground">
          Name
        </label>
        <input
          id="action-name"
          type="text"
          value={name}
          disabled={saving}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. product_search"
          className={inputCls}
        />
        <p className="text-xs text-muted-foreground">
          The agent invokes it by this name. Lowercase and underscores read best.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="action-description" className="block text-xs font-medium text-foreground">
          What does this do?
        </label>
        <textarea
          id="action-description"
          rows={2}
          value={description}
          disabled={saving}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Search the product catalogue for what the buyer asked for"
          className={inputCls}
        />
        <p className="text-xs text-muted-foreground">
          The agent reads this to decide <em>when</em> to use the action. Vague wording is the main
          cause of an agent calling the wrong thing.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="space-y-1.5">
          <label htmlFor="action-method" className="block text-xs font-medium text-foreground">
            Method
          </label>
          <select
            id="action-method"
            value={method}
            disabled={saving}
            onChange={(e) => setMethod(e.target.value)}
            className={inputCls}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-1.5">
          <label htmlFor="action-path" className="block text-xs font-medium text-foreground">
            Path
          </label>
          <input
            id="action-path"
            type="text"
            value={path}
            disabled={saving}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/products/search"
            className={inputCls}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 px-3 py-2">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          The call this makes
        </span>
        <code className="block break-all text-xs text-foreground">
          {buildPreviewUrl(method, path.trim() || '/', pathParamRows, queryParams)}
        </code>
      </div>

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

      {bodyAllowed ? (
        <ToolBodyEditor rows={bodyFields} setRows={setBodyFields} disabled={saving} />
      ) : (
        <ToolParamsEditor label="Query parameters" rows={queryParams} setRows={setQueryParams} disabled={saving} />
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Advanced
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-4">
            {bodyAllowed && (
              <ToolParamsEditor label="Query parameters" rows={queryParams} setRows={setQueryParams} disabled={saving} />
            )}
            <ToolParamsEditor label="Headers" rows={headerParams} setRows={setHeaderParams} disabled={saving} />
            <p className="text-xs text-muted-foreground">
              Bodies are JSON only — Meta accepts no other request content type. An API that
              returns XML is fine; one that needs an XML body cannot be connected.
            </p>
          </div>
        )}
      </div>

      {rowError && <p className="text-xs text-destructive">{rowError}</p>}
      {error ? <ErrorBanner error={error} /> : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2.5
            text-sm font-semibold text-white transition-opacity hover:opacity-90
            disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {action ? 'Save action' : 'Add action'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
