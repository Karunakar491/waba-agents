import { Plus, Rocket, Trash2 } from 'lucide-react'
import StatusIndicator from '../../shared/StatusIndicator'
import ConnectorDefinitionEditor from '../ConnectorDefinitionEditor'
import ConnectorActionsTable from './ConnectorActionsTable'
import { META_MACROS } from './metaMacros'
import { type ConnectorAction } from '../connectorActions'
import { AUTH_TYPES, type ConnectorFormValues, type LibraryConnector } from '../connectorLibrary'

/**
 * A connector, laid out like a Postman collection.
 *
 * Tabs, because operators here already know Postman and paid for our own
 * arrangement on every visit: Actions are the requests in the collection,
 * Details is its Overview, Authorization is Authorization, Variables is
 * Variables. Agents has no Postman equivalent — it is Meta's, and it is the
 * question "who breaks if I change this".
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
  tab,
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
  /**
   * Which section is showing. Owned by the page, not here, because the header
   * renders the section nav — it has to stay reachable while an action is
   * open, and an action replaces this whole pane.
   */
  tab: string
}) {
  const behind = connector.deployments.filter((d) => d.status === 'OUT_OF_SYNC').length
  const authLabel =
    AUTH_TYPES.find((a) => a.value === form.authType)?.label ?? form.authType

  return (
    <div className="space-y-4">
      {tab === 'actions' && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* One line, truncated. Spelled out as a sentence it wrapped to
                two and a long Apps Script base URL swamped the tab. */}
            <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">Every action inherits:</span>
              <code className="shrink-0">{authLabel}</code>
              <span className="shrink-0">·</span>
              <code className="min-w-0 truncate" title={connector.baseUrl}>
                {connector.baseUrl}
              </code>
            </p>
            {/* Only offered once there is a table to add to. On an empty
                connector the form is already open below, so a button here
                would be a click that produces what is on screen. */}
            {!!actions?.length && (
              <button
                type="button"
                onClick={onAddAction}
                className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3
                  text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Add an action
              </button>
            )}
          </div>

          {actions === undefined ? (
            <p className="text-sm text-muted-foreground">Loading actions…</p>
          ) : actions.length === 0 ? (
            // Only reachable by landing here with actions still loading and
            // then finding none — selecting the tab navigates instead.
            <p className="text-sm text-muted-foreground">No actions yet.</p>
          ) : (
            <ConnectorActionsTable actions={actions} onOpenAction={onOpenAction} />
          )}
        </section>
      )}

      {(tab === 'details' || tab === 'auth') && (
        <div className="max-w-3xl">
          <ConnectorDefinitionEditor
            isEditing
            chrome={false}
            section={tab === 'auth' ? 'auth' : 'details'}
            form={form}
            error={detailsError}
            saving={saving}
            onChange={onFormChange}
            onSave={onSave}
            onCancel={onResetForm}
          />

          {tab === 'details' && (
            /* Deleting is a Details concern — it is the connector itself, not
               one of its requests. Refused while any agent still runs it,
               because the backend refuses too ("deployed to at least one
               agent"); saying so on the control beats asking and then failing. */
            <section className="mt-6 space-y-2 border-t pt-4">
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
                  {connector.usedByAgentCount === 1 ? 'agent' : 'agents'} — see the Agents tab.
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {tab === 'variables' && (
        <section className="max-w-3xl space-y-2">
          {/* Read-only on purpose: this is Meta's set, not ours, and it is
              closed. These were only discoverable inside a parameter's fill
              dropdown, which is a poor place to learn what exists. */}
          <p className="text-xs text-muted-foreground">
            Meta substitutes these at call time. The set is fixed — you cannot add one. Pick one as
            a parameter&apos;s value on any action.
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
      )}

      {tab === 'agents' && (
        <section className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Who is affected by a change here.
            </p>
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
      )}
    </div>
  )
}
