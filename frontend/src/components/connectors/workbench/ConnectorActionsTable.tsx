import { useState } from 'react'
import { MethodBadge } from './WorkbenchSidebar'
import { summariseAction, type ConnectorAction } from '../connectorActions'
import { parseRequestDefinition } from '../../agent-detail/toolRequestDefinition'
import { HTTP_METHODS } from '../connectorActions'

/**
 * A connector's actions, as the table in `design/Main.dc.html`.
 *
 * Six columns, and they are chosen for comparing across actions rather than
 * reading one: which of them takes a body, which needs parameters, what each
 * hits, and what each is for. That is the question you open a connector to
 * answer. Description had been folded under the name as a second line, which
 * made the rows two-storey and the column impossible to scan down.
 *
 * The last row is the add. There is no button: "why should we have add action
 * as a separate button — why an extra step for every single thing". Typing a
 * name and a path in the trailing row and leaving it creates the action, and
 * the row it becomes is the row you were just typing in.
 *
 * Its own file because ConnectorPane is the screen's structure and this is a
 * hundred lines of `<td>`.
 */
export default function ConnectorActionsTable({
  actions,
  onOpenAction,
  onCreate,
  creating,
}: {
  actions: ConnectorAction[]
  onOpenAction: (actionId: string) => void
  /**
   * Creates one from the trailing row. Undefined while the connector cannot
   * take a new action yet, which is the only case the row hides.
   */
  onCreate?: (draft: { method: string; name: string; path: string; description: string }) => void
  creating?: boolean
}) {
  const [method, setMethod] = useState('GET')
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [description, setDescription] = useState('')

  /**
   * Meta needs all four, so all four are asked for here rather than creating
   * something half-formed that fails later at deploy. Description especially:
   * it is what the agent reads to decide when to call this, and an action
   * without one is an action the model cannot use.
   */
  const ready = !!name.trim() && !!path.trim() && !!description.trim()

  function submit() {
    if (!ready || !onCreate || creating) return
    onCreate({
      method,
      name: name.trim(),
      path: path.trim(),
      description: description.trim(),
    })
    setMethod('GET')
    setName('')
    setPath('')
    setDescription('')
  }

  const cell = 'px-4 py-2 align-middle'
  const ghostInput =
    'w-full bg-transparent text-sm placeholder:text-muted-foreground/70 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded'

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="w-[78px] px-4 py-2 font-medium">Method</th>
            <th className="w-[176px] px-4 py-2 font-medium">Name</th>
            <th className="w-[196px] px-4 py-2 font-medium">Path</th>
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="w-[78px] px-4 py-2 text-right font-medium">Params</th>
            <th className="w-[66px] px-4 py-2 text-right font-medium">Body</th>
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
              <tr key={action.id} className="h-11 border-b hover:bg-muted/30">
                <td className={cell}>
                  <MethodBadge method={parsed?.method ?? 'GET'} />
                </td>
                <td className={cell}>
                  <button
                    type="button"
                    onClick={() => onOpenAction(action.id)}
                    className="block max-w-full truncate text-left font-mono text-sm text-foreground
                      hover:underline focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-primary"
                  >
                    {action.name}
                  </button>
                </td>
                <td
                  className={`${cell} font-mono text-xs text-muted-foreground`}
                  title={summariseAction(action)}
                >
                  <span className="block truncate">{parsed?.path ?? '—'}</span>
                </td>
                <td className={`${cell} text-muted-foreground`}>
                  <span className="block truncate">{action.description}</span>
                </td>
                <td className={`${cell} text-right tabular-nums text-muted-foreground`}>
                  {params || '—'}
                </td>
                <td className={`${cell} text-right tabular-nums text-muted-foreground`}>
                  {parsed && parsed.bodyFields.length > 0 ? parsed.bodyFields.length : '—'}
                </td>
              </tr>
            )
          })}

          {/* The add. Tinted, so it reads as the row that is not yet a row. */}
          {onCreate && (
            <tr className="h-11 bg-muted/20">
              <td className={cell}>
                <select
                  aria-label="Method for the new action"
                  value={method}
                  disabled={creating}
                  onChange={(e) => setMethod(e.target.value)}
                  className="bg-transparent font-mono text-[11px] font-bold uppercase
                    text-muted-foreground focus-visible:outline-none"
                >
                  {HTTP_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </td>
              <td className={cell}>
                <input
                  type="text"
                  aria-label="Name for the new action"
                  value={name}
                  disabled={creating}
                  spellCheck={false}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="name"
                  className={`${ghostInput} font-mono`}
                />
              </td>
              <td className={cell}>
                <input
                  type="text"
                  aria-label="Path for the new action"
                  value={path}
                  disabled={creating}
                  spellCheck={false}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="/path"
                  className={`${ghostInput} font-mono text-xs`}
                />
              </td>
              <td className={cell}>
                <input
                  type="text"
                  aria-label="Description for the new action"
                  value={description}
                  disabled={creating}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="what it does"
                  className={ghostInput}
                />
              </td>
              <td className={`${cell} text-right`}>
                {/* Nothing to count until it exists, and the button carries the
                    action so the row is reachable by keyboard as well as by
                    pressing Enter in any field. */}
                <button
                  type="button"
                  onClick={submit}
                  disabled={!ready || creating}
                  title={
                    ready
                      ? 'Add this action'
                      : 'Needs a name, a path and a description — Meta requires all three'
                  }
                  className="text-xs font-semibold text-accent-teal-solid transition-opacity
                    hover:opacity-80 disabled:cursor-not-allowed disabled:text-muted-foreground/60"
                >
                  {creating ? 'Adding…' : 'Add'}
                </button>
              </td>
              <td className={`${cell} text-right text-muted-foreground/60`}>—</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
