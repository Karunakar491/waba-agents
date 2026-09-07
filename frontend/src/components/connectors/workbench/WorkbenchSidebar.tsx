import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { ConnectorAction } from '../connectorActions'
import type { LibraryConnector } from '../connectorLibrary'

/**
 * The workbench's navigation: every connector, expanding to the tools inside it.
 *
 * Two things about the shape are Meta's, not Postman's.
 *
 * A tool is nested under exactly one connector and cannot be moved, because on
 * Meta it lives at
 * /{phoneNumberId}/agent_connectors/{connectorId}/tools — the connector is part
 * of its address. So this is a two-level tree with no dragging, not a folder
 * system.
 *
 * And a connector is itself selectable, not just a container, because auth, the
 * certificate and the base URL live on it and nowhere else.
 */
export default function WorkbenchSidebar({
  connectors,
  actionsByConnector,
  selectedConnectorId,
  selectedActionId,
  expanded,
  onToggleExpand,
  onSelectConnector,
  onSelectAction,
  onNewConnector,
  onNewAction,
}: {
  connectors: LibraryConnector[]
  /** Loaded lazily — a connector that has never been opened has no entry yet. */
  actionsByConnector: Record<string, ConnectorAction[] | undefined>
  selectedConnectorId: string | null
  selectedActionId: string | null
  expanded: Record<string, boolean>
  onToggleExpand: (connectorId: string) => void
  onSelectConnector: (connectorId: string) => void
  onSelectAction: (connectorId: string, actionId: string) => void
  onNewConnector: () => void
  onNewAction: (connectorId: string) => void
}) {
  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Connectors
        </span>
        <button
          type="button"
          onClick={onNewConnector}
          aria-label="New connector"
          title="New connector"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground
            transition-colors hover:bg-muted hover:text-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {connectors.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            No connectors yet. Add one to give an agent an API it can call.
          </p>
        ) : (
          connectors.map((connector) => {
            const isOpen = !!expanded[connector.id]
            const actions = actionsByConnector[connector.id]
            const connectorSelected = selectedConnectorId === connector.id && !selectedActionId

            return (
              <div key={connector.id}>
                <div
                  className={cn(
                    'flex items-center gap-0.5 pr-2',
                    connectorSelected && 'bg-accent-teal/10',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleExpand(connector.id)}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${connector.name}`}
                    aria-expanded={isOpen}
                    className="flex h-9 w-6 shrink-0 items-center justify-center text-muted-foreground
                      transition-colors hover:text-foreground"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectConnector(connector.id)}
                    aria-current={connectorSelected ? 'true' : undefined}
                    className={cn(
                      'min-w-0 flex-1 py-2 pr-1 text-left text-sm transition-colors',
                      connectorSelected
                        ? 'font-medium text-foreground'
                        : 'text-foreground hover:text-accent-teal-solid',
                    )}
                  >
                    <span className="block truncate" title={connector.name}>
                      {connector.name}
                    </span>
                  </button>
                  {connector.status === 'DRAFT' && (
                    <span
                      title="Not published"
                      className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      Draft
                    </span>
                  )}
                </div>

                {isOpen && (
                  <div className="pb-1 pl-6">
                    {actions === undefined ? (
                      <p className="py-1.5 pl-2 text-xs text-muted-foreground">Loading…</p>
                    ) : actions.length === 0 ? (
                      <p className="py-1.5 pl-2 text-xs text-muted-foreground">
                        Nothing it can do yet
                      </p>
                    ) : (
                      actions.map((action) => {
                        const selected = selectedActionId === action.id
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => onSelectAction(connector.id, action.id)}
                            aria-current={selected ? 'true' : undefined}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md py-1.5 pl-2 pr-1 text-left transition-colors',
                              selected
                                ? 'bg-accent-teal/10 font-medium text-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                          >
                            <MethodBadge method={action.requestDefinition?.method ?? 'GET'} />
                            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={action.name}>
                              {action.name}
                            </span>
                          </button>
                        )
                      })
                    )}
                    <button
                      type="button"
                      onClick={() => onNewAction(connector.id)}
                      className="flex w-full items-center gap-1.5 rounded-md py-1.5 pl-2 text-left text-xs
                        text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                      Add an action
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/**
 * The verb, coloured the way every API tool colours it — the one Postman
 * convention worth copying outright, because operators already read it without
 * thinking. Width is fixed so the tool names below it line up.
 */
const METHOD_TONE: Record<string, string> = {
  GET: 'text-accent-teal-solid',
  POST: 'text-warning',
  PUT: 'text-primary',
  PATCH: 'text-primary',
  DELETE: 'text-destructive',
}

export function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        'w-11 shrink-0 text-right font-mono text-[10px] font-semibold uppercase',
        METHOD_TONE[method] ?? 'text-muted-foreground',
      )}
    >
      {method}
    </span>
  )
}
