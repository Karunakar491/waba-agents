import { Rocket, Trash2 } from 'lucide-react'
import StatusIndicator from '../../shared/StatusIndicator'
import ConnectorActionsTable from './ConnectorActionsTable'
import PropertyTable, { type PropertyRow } from './PropertyTable'
import { META_MACROS } from './metaMacros'
import { type ConnectorAction } from '../connectorActions'
import { type ConnectorFormValues, type LibraryConnector } from '../connectorLibrary'

/**
 * The connector, built to `design/Main.dc.html`.
 *
 * Three things in this order and nothing else: the property table, the Actions
 * table, the Agents strip. No tab row — a connector holds seven fields, a
 * fixed macro list and a deployment fact, so navigation here was invented to
 * fill a screen.
 *
 * The previous version claimed to be this screen and was not: it kept the old
 * edit form — an info banner over seven stacked labelled fields with its own
 * Save and Cancel — and appended the sections underneath. On a 900px screen
 * that put Actions below the fold, so a connector reading "Nothing it can do
 * yet" in the sidebar showed no Actions table at all. Tabs had been traded for
 * scroll and called an improvement.
 *
 * Base URL, Auth, Credentials and Certificate are NOT here. They are rows of
 * the property table on an action's Authorization tab, which is where the
 * canvas puts them — "editable here because this is where it is used". They
 * were briefly rows of this table, on my reading that the canvas drew them
 * nowhere; it draws them on ActionAuth.dc.html.
 */
export default function ConnectorPane({
  connector,
  actions,
  form,
  saving,
  onFieldChange,
  onOpenAction,
  onCreateAction,
  creatingAction,
  onPublish,
  onRequestDelete,
}: {
  connector: LibraryConnector
  /** undefined while still loading. */
  actions: ConnectorAction[] | undefined
  form: ConnectorFormValues
  saving: boolean
  /** Saves one field. The table is the form, so there is no Save button. */
  onFieldChange: (patch: Partial<ConnectorFormValues>) => void
  onOpenAction: (actionId: string) => void
  onCreateAction: (draft: {
    method: string
    name: string
    path: string
    description: string
  }) => void
  creatingAction: boolean
  onPublish: () => void
  onRequestDelete: () => void
}) {
  const behind = connector.deployments.filter((d) => d.status === 'OUT_OF_SYNC').length


  const rows: PropertyRow[] = [
    {
      label: 'Name',
      value: form.name,
      placeholder: 'what this connector is called',
      onChange: (value) => onFieldChange({ name: value }),
    },
    {
      label: 'Description',
      value: form.description,
      placeholder: 'what this API is for',
      multiline: true,
      onChange: (value) => onFieldChange({ description: value }),
    },
    {
      label: 'Tags',
      value: form.tags,
      placeholder: 'none yet',
      display: form.tags.trim() ? (
        <span className="inline-flex flex-wrap gap-1.5">
          {form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .map((tag) => (
              <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[11.5px] text-muted-foreground">
                {tag}
              </span>
            ))}
        </span>
      ) : undefined,
      onChange: (value) => onFieldChange({ tags: value }),
    },
  ]

  return (
    <div className="space-y-6">
      <PropertyTable rows={rows} disabled={saving} />

      {/* Named, because the sidebar tree carries an "Add an action" of its own
          and the two were indistinguishable to anything addressing the page by
          role — a screen reader included. */}
      <section aria-label="Actions" className="space-y-2">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Actions
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            {actions?.length ?? 0}
          </span>
        </div>

        {actions === undefined ? (
          <p className="text-sm text-muted-foreground">Loading actions…</p>
        ) : (
          <ConnectorActionsTable
            actions={actions}
            onOpenAction={onOpenAction}
            onCreate={onCreateAction}
            creating={creatingAction}
          />
        )}

        {actions?.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Type in the last row to add one. Method, name, path and description are all Meta needs;
            parameters and body are added by opening it.
          </p>
        )}
      </section>

      {/* One strip, not a section: the answer to "who breaks if I change this"
          is a list of names and a button, and it fits on a line. */}
      <section aria-label="Agents" className="max-w-[980px] space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Agents
          </h2>

          {connector.deployments.length === 0 ? (
            <span className="text-sm text-muted-foreground">Not on any agent</span>
          ) : (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {connector.deployments.map((d) => (
                <span
                  key={`${d.agentId}-${d.metaConnectorId ?? 'none'}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="max-w-[200px] truncate text-foreground">
                    {d.agentName ?? d.agentId}
                  </span>
                  <StatusIndicator
                    label={d.status === 'OUT_OF_SYNC' ? 'Behind — republish' : 'Up to date'}
                    tone={d.status === 'OUT_OF_SYNC' ? 'warning' : 'positive'}
                  />
                </span>
              ))}
            </span>
          )}

          <button
            type="button"
            onClick={onPublish}
            disabled={!actions?.length}
            title={
              actions?.length
                ? 'Make this real on Meta, on an agent you choose'
                : 'Add an action first — there is nothing for an agent to call'
            }
            className="ml-auto flex min-h-11 items-center gap-1.5 rounded-lg bg-accent-teal-solid px-3.5
              text-xs font-semibold text-white transition-opacity hover:opacity-90
              disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            <Rocket className="h-3.5 w-3.5" />
            Publish
          </button>
        </div>

        {behind > 0 && (
          <p className="text-xs font-medium text-warning">
            {behind} of {connector.deployments.length} still running an older version — publish
            again to bring {behind === 1 ? 'it' : 'them'} up to date.
          </p>
        )}
      </section>

      {/* Below the fold on purpose, both of them: a reference nobody edits, and
          the one control that destroys something. Refused while any agent still
          runs it, because the backend refuses too. */}
      <details className="max-w-[980px] border-t pt-4">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Variables you can substitute
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Meta fills these in at call time. The set is fixed — you cannot add one. Use one as a
          parameter&apos;s value on any action.
        </p>
        <div className="mt-2 overflow-hidden rounded-xl border bg-card">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {META_MACROS.map(([name, meaning]) => (
                <tr key={name} className="h-11 border-b last:border-b-0">
                  <td className="w-[172px] px-4 font-mono text-xs text-foreground">{name}</td>
                  <td className="px-4 text-muted-foreground">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="max-w-[980px] border-t pt-4">
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
      </div>
    </div>
  )
}
