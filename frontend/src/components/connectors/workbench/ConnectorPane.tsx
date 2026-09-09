import { Plus, Rocket, Trash2 } from 'lucide-react'
import StatusIndicator from '../../shared/StatusIndicator'
import ConnectorDefinitionEditor from '../ConnectorDefinitionEditor'
import ConnectorActionsTable from './ConnectorActionsTable'
import { META_MACROS } from './metaMacros'
import { type ConnectorAction } from '../connectorActions'
import { AUTH_TYPES, type ConnectorFormValues, type LibraryConnector } from '../connectorLibrary'

/**
 * A connector, on one page.
 *
 * It had five tabs — Actions, Details, Authorization, Variables, Agents — and
 * they were a mistake twice over. They put a second tab strip on screen
 * whenever an action was open, with "Authorization" and "Headers" appearing
 * twice; and they hid four fifths of a small object behind clicks. A connector
 * is a name, a base URL, one credential, a fixed list of Meta's variables and
 * the set of agents running it. That is a page you read, not a space you
 * navigate. Postman tabs a collection because a collection can hold hundreds
 * of things; this holds seven fields.
 *
 * Order is the order the questions get asked: what is this, what can it do,
 * who is running it, what can I substitute.
 *
 * What Postman has that this deliberately does not:
 *
 * - Collection-level **Headers** and **Body**. Meta's connector object has
 *   neither. Postman merges collection headers into every request; doing that
 *   here would make an action's Headers tab show rows nobody typed there, and
 *   the merge would be ours rather than Meta's. Headers stay per-action.
 * - **Scripts**, **Settings**, **Runs**. Meta's runtime makes the call, so
 *   there is no pre-request script, no timeout to set and no run history.
 *
 * Authorization is a real tab here — unlike on an action, where it can only
 * report what it inherits — because a connector is the only thing in Meta that
 * can hold credentials.
 */
export default function ConnectorPane({
  connector,
  actions,
  form,
  detailsError,
  saving,
  onFormChange,
  onSave,
  onResetForm,
  onOpenAction,
  onAddAction,
  onPublish,
  onRequestDelete,
}: {
  connector: LibraryConnector
  /** undefined while still loading. */
  actions: ConnectorAction[] | undefined
  form: ConnectorFormValues
  detailsError: string | null
  saving: boolean
  onFormChange: (form: ConnectorFormValues) => void
  onSave: () => void
  onResetForm: () => void
  onOpenAction: (actionId: string) => void
  onAddAction: () => void
  onPublish: () => void
  onRequestDelete: () => void
}) {
  const behind = connector.deployments.filter((d) => d.status === 'OUT_OF_SYNC').length
  const authLabel =
    AUTH_TYPES.find((a) => a.value === form.authType)?.label ?? form.authType

  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-2">
        <ConnectorDefinitionEditor
          isEditing
          chrome={false}
          form={form}
          error={detailsError}
          saving={saving}
          onChange={onFormChange}
          onSave={onSave}
          onCancel={onResetForm}
        />
      </section>

      {/* Named, because the sidebar tree carries an "Add an action" of its own
          and the two were indistinguishable to anything addressing the page by
          role — a screen reader included. */}
      <section aria-label="Actions" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Actions</h2>
            {/* One line, truncated. Spelled out as a sentence it wrapped to
                two and a long Apps Script base URL swamped the heading. */}
            <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">Each one inherits:</span>
              <code className="shrink-0">{authLabel}</code>
              <span className="shrink-0">·</span>
              <code className="min-w-0 truncate" title={connector.baseUrl}>
                {connector.baseUrl}
              </code>
            </p>
          </div>
          <button
            type="button"
            onClick={onAddAction}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3
              text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add an action
          </button>
        </div>

        {actions === undefined ? (
          <p className="text-sm text-muted-foreground">Loading actions…</p>
        ) : actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions yet, so no agent can call this API.
          </p>
        ) : (
          <ConnectorActionsTable actions={actions} onOpenAction={onOpenAction} />
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Agents</h2>
            <p className="text-xs text-muted-foreground">Who is affected by a change here.</p>
          </div>
            {/* "Publish" everywhere in this product means: make it real on
                Meta. This is that button, and it opens the agent picker. */}
            <button
              type="button"
              onClick={onPublish}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3
                text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Rocket className="h-3.5 w-3.5" />
              Publish to an agent
            </button>
          </div>

          {connector.deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not on any agent, so nothing here can be called by a customer yet.
            </p>
          ) : (
            <>
              {behind > 0 && (
                <p className="text-xs font-medium text-warning">
                  {behind} of {connector.deployments.length} still running an older version —
                  publish again to bring {behind === 1 ? 'it' : 'them'} up to date.
                </p>
              )}
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {connector.deployments.map((d) => (
                  <li
                    key={`${d.agentId}-${d.metaConnectorId ?? 'none'}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate text-foreground">
                      {d.agentName ?? d.agentId}
                    </span>
                    <StatusIndicator
                      label={d.status === 'OUT_OF_SYNC' ? 'Behind — republish' : 'Up to date'}
                      tone={d.status === 'OUT_OF_SYNC' ? 'warning' : 'positive'}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
      </section>

      {/* Last, because it is a reference rather than a setting. Read-only on
          purpose: this is Meta's set, not ours, and it is closed. These were
          only discoverable inside a parameter's fill dropdown, which is a poor
          place to learn what exists. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Variables you can substitute</h2>
        <p className="text-xs text-muted-foreground">
          Meta fills these in at call time. The set is fixed — you cannot add one. Use one as a
          parameter&apos;s value on any action.
        </p>
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Variable</th>
                <th className="px-3 py-2 font-medium">Resolves to</th>
              </tr>
            </thead>
            <tbody>
              {META_MACROS.map(([name, meaning]) => (
                <tr key={name} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">{name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Refused while any agent still runs it, because the backend refuses too
          ("deployed to at least one agent"); saying so on the control beats
          asking and then failing. */}
      <section className="space-y-2 border-t pt-5">
        <button
          type="button"
          onClick={onRequestDelete}
          disabled={connector.usedByAgentCount > 0}
          title={
            connector.usedByAgentCount > 0
              ? `On ${connector.usedByAgentCount} agent${connector.usedByAgentCount === 1 ? '' : 's'} — remove it from those agents before deleting it.`
              : 'Delete this connector and its actions'
          }
          className="flex min-h-11 items-center gap-1.5 rounded-lg border border-destructive px-3 text-xs
            font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white
            disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground
            disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete connector
        </button>
        {connector.usedByAgentCount > 0 && (
          <p className="text-xs text-muted-foreground">
            On {connector.usedByAgentCount}{' '}
            {connector.usedByAgentCount === 1 ? 'agent' : 'agents'} — listed above.
          </p>
        )}
      </section>
    </div>
  )
}
