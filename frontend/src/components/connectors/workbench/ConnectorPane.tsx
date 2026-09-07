import { Plus, Rocket, Trash2 } from 'lucide-react'
import StatusIndicator from '../../shared/StatusIndicator'
import ConnectorDefinitionEditor from '../ConnectorDefinitionEditor'
import { MethodBadge } from './WorkbenchSidebar'
import { summariseAction, type ConnectorAction } from '../connectorActions'
import type { ConnectorFormValues, LibraryConnector } from '../connectorLibrary'

/**
 * A connector: what it is, and what it can do — on one screen.
 *
 * This replaced a set of tabs (Details / Auth / Deployments). Auth was the tell
 * that the split was wrong: authentication is part of the connector's
 * definition and already lives in the form below, so the Auth tab could only
 * ever be a signpost saying "it's on the other tab" — a tab whose content is
 * directions to different content.
 *
 * Selecting a collection in Postman shows you the requests in it. The same
 * thing is true here: the question someone opens a connector to answer is
 * usually "what can this do", so the actions are on the page rather than behind
 * navigation. Tabs stay where they earn their place — inside a single action,
 * where Params, Headers and Body genuinely are alternative views of one thing.
 *
 * Where it is deployed is a strip rather than a tab, because it is a fact about
 * the connector, not a workspace: three lines telling you who would be affected
 * by a change, which is exactly what you want visible while making one.
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

  return (
    <div className="space-y-6">
      {/* --- What it can do. First, because it is the usual reason for opening
              a connector, and because an empty one is the thing most worth
              saying out loud. ------------------------------------------- */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">What it can do</h2>
            <p className="text-xs text-muted-foreground">
              Each action is one call the agent can make.
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
          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm font-medium text-foreground">
              This connector can&apos;t do anything yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add an action so an agent has something to call. Until then, deploying it achieves
              nothing.
            </p>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {actions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => onOpenAction(action.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <MethodBadge method={action.requestDefinition?.method ?? 'GET'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm text-foreground">
                      {action.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                  <code className="hidden shrink-0 text-xs text-muted-foreground lg:block">
                    {summariseAction(action)}
                  </code>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Where it runs. A strip, not a tab. ---------------------------- */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Where it runs</h2>
          {/* "Publish" everywhere in this product means: make it real on Meta.
              This is that button, and it opens the agent picker — there is no
              other kind of publishing for a connector. A second button called
              Publish used to sit in the list and only flip a local flag that
              gated nothing, so the word pointed at the wrong action. */}
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
            Not on any agent yet, so nothing here can be called by a customer.
          </p>
        ) : (
          <>
            {behind > 0 && (
              <p className="text-xs font-medium text-warning">
                {behind} of {connector.deployments.length} still running an older version — deploy
                again to bring {behind === 1 ? 'it' : 'them'} up to date.
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
                    label={d.status === 'OUT_OF_SYNC' ? 'Behind — redeploy' : 'Up to date'}
                    tone={d.status === 'OUT_OF_SYNC' ? 'warning' : 'positive'}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* --- What it is. Auth included, because auth is part of the
              definition rather than a separate concern. ------------------ */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Where it is, and how it signs in</h2>
        <div className="max-w-3xl">
          <ConnectorDefinitionEditor
            isEditing
            form={form}
            error={detailsError}
            saving={saving}
            onChange={onFormChange}
            onSave={onSave}
            onCancel={onResetForm}
          />
        </div>
      </section>

      {/* --- Removing it. Last, and refused while any agent still runs it,
              because the backend refuses too: "This connector is deployed to
              at least one agent. Remove it from those agents first." Saying so
              on the control beats asking and then failing. ------------- */}
      <section className="space-y-2 border-t pt-4">
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
            Remove it from the {connector.usedByAgentCount === 1 ? 'agent' : 'agents'} above first.
          </p>
        )}
      </section>
    </div>
  )
}
