import { MethodBadge } from './WorkbenchSidebar'
import { summariseAction, type ConnectorAction } from '../connectorActions'
import { parseRequestDefinition } from '../../agent-detail/toolRequestDefinition'

/**
 * A connector's actions, as a table.
 *
 * The founder's call — "we can have everything like this in a table" — and the
 * columns are chosen for comparing across actions rather than reading one:
 * which of them takes a body, which needs parameters, what each one hits. That
 * is the question you open a connector to answer.
 *
 * Its own file because ConnectorPane is a tab shell and this is the content of
 * one tab; keeping both in one file put the shell's structure out of sight
 * below a hundred lines of `<td>`.
 */
export default function ConnectorActionsTable({
  actions,
  onOpenAction,
}: {
  actions: ConnectorAction[]
  onOpenAction: (actionId: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="w-20 px-3 py-2 font-medium">Method</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Path</th>
            <th className="w-20 px-3 py-2 text-right font-medium">Params</th>
            <th className="w-16 px-3 py-2 text-right font-medium">Body</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => {
            // requestDefinition is nullable — an action stored before the field
            // existed still lists, it just has nothing for these columns.
            const parsed = action.requestDefinition
              ? parseRequestDefinition(action.requestDefinition)
              : null
            const params = parsed
              ? parsed.pathParams.length + parsed.queryParams.length + parsed.headerParams.length
              : 0
            return (
              <tr key={action.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <MethodBadge method={parsed?.method ?? 'GET'} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenAction(action.id)}
                    className="block max-w-xs truncate text-left font-mono text-sm text-foreground
                      hover:underline focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-primary"
                  >
                    {action.name}
                  </button>
                  <span className="block max-w-md truncate text-xs text-muted-foreground">
                    {action.description}
                  </span>
                </td>
                <td
                  className="px-3 py-2 font-mono text-xs text-muted-foreground"
                  title={summariseAction(action)}
                >
                  {parsed?.path ?? '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {params || '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {parsed && parsed.bodyFields.length > 0 ? parsed.bodyFields.length : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
