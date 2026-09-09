import { Plus, Trash2 } from 'lucide-react'
import type { ParamRow, ParamType, FillMode } from './toolRequestDefinition'
import { inputCls, touchButtonCls, addButtonCls, idSlug } from './toolEditorStyles'
import { FILL_OPTIONS, ADVANCED_FILL_OPTIONS } from './toolFillOptions'

/** "Query parameters" -> "query parameter", "Headers" -> "header" — singular for the Add-row button copy. */
function singularize(label: string): string {
  return label.toLowerCase().replace(/s$/, '')
}

const PARAM_TYPES: ParamType[] = ['string', 'integer', 'number', 'boolean']

/**
 * Query params, path params or headers, as a table.
 *
 * Five columns, each one thing. It had three — Key, Value, Description — with
 * the type dropdown and the Required checkbox both crammed into the
 * Description cell as a second line, so two of the five things you set per row
 * were hiding inside a third. The founder, holding up Postman's Headers tab:
 * "cant we have everything in tables like this?"
 *
 * What is deliberately NOT copied from that screenshot is Postman's leading
 * checkbox, which disables a row. Meta has no disabled parameter — the
 * checkbox here is Required, which is real.
 */
export default function ToolParamsEditor({
  label,
  rows,
  setRows,
  lockedKeys = [],
  showAdd = true,
  disabled = false,
}: {
  label: string
  rows: ParamRow[]
  setRows: (updater: (prev: ParamRow[]) => ParamRow[]) => void
  /** Path-param keys auto-detected from {placeholder} tokens — key is not editable for these rows. */
  lockedKeys?: string[]
  /**
   * false for path-parameter usage: that row list is fully derived from the Path field,
   * so an "Add" button there would append a row with a blank key that gets silently
   * discarded on the next render (its key can never match a real path token) — a phantom
   * control. Path params gain/lose rows only by editing the Path field itself.
   */
  showAdd?: boolean
  /** True while the form is saving — every control here freezes. */
  disabled?: boolean
}) {
  const patch = (i: number, p: Partial<ParamRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...p } : r)))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {showAdd && (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setRows((prev) => [
                ...prev,
                {
                  key: '',
                  type: 'string',
                  description: '',
                  required: false,
                  fill: 'agent',
                  fixedValue: '',
                },
              ])
            }
            className={addButtonCls}
          >
            <Plus className="h-3.5 w-3.5" /> Add {singularize(label)}
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="w-1/5 px-3 py-2 font-medium">Key</th>
                <th className="w-24 px-3 py-2 font-medium">Type</th>
                <th className="w-1/4 px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="w-20 px-3 py-2 text-center font-medium">Required</th>
                <th className="w-11 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const locked = lockedKeys.includes(row.key)
                const rowDescriptor = row.key.trim() || `row ${i + 1}`
                const id = `${idSlug(label)}-${i}`
                return (
                  <tr key={i} className="border-b align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`${id}-key`}>
                        {label} name
                      </label>
                      <input
                        id={`${id}-key`}
                        type="text"
                        value={row.key}
                        disabled={locked || disabled}
                        onChange={(e) => patch(i, { key: e.target.value })}
                        placeholder="Key"
                        className={`${inputCls} w-full font-mono disabled:opacity-60`}
                      />
                    </td>

                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`${id}-type`}>
                        {label} type
                      </label>
                      <select
                        id={`${id}-type`}
                        value={row.type}
                        disabled={disabled}
                        onChange={(e) => patch(i, { type: e.target.value as ParamType })}
                        className={`${inputCls} w-full`}
                      >
                        {PARAM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`${id}-fill`}>
                        Who fills in {rowDescriptor}
                      </label>
                      <select
                        id={`${id}-fill`}
                        value={row.fill}
                        disabled={disabled}
                        onChange={(e) => patch(i, { fill: e.target.value as FillMode })}
                        className={`${inputCls} w-full`}
                      >
                        {FILL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        <optgroup label="Advanced (rarely needed)">
                          {ADVANCED_FILL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      {row.fill === 'fixed' && (
                        <>
                          <label className="sr-only" htmlFor={`${id}-fixedvalue`}>
                            Fixed value for {rowDescriptor}
                          </label>
                          <input
                            id={`${id}-fixedvalue`}
                            type="text"
                            value={row.fixedValue}
                            disabled={disabled}
                            onChange={(e) => patch(i, { fixedValue: e.target.value })}
                            placeholder="Value"
                            className={`${inputCls} mt-1.5 w-full disabled:opacity-60`}
                          />
                        </>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`${id}-description`}>
                        {label} description
                      </label>
                      <input
                        id={`${id}-description`}
                        type="text"
                        value={row.description}
                        disabled={disabled}
                        onChange={(e) => patch(i, { description: e.target.value })}
                        placeholder="What the agent should put here"
                        className={`${inputCls} w-full disabled:opacity-60`}
                      />
                    </td>

                    <td className="px-3 py-2 text-center">
                      {locked ? (
                        // Path parameters are always required — connector-tools.md:
                        // "Ignored for path params (always required)." A checkbox here
                        // would let the operator toggle something Meta ignores.
                        <span className="text-muted-foreground" title="Path parameters are always required">
                          always
                        </span>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`${id}-required`}>
                            {rowDescriptor} is required
                          </label>
                          <input
                            id={`${id}-required`}
                            type="checkbox"
                            checked={row.required}
                            disabled={disabled}
                            onChange={(e) => patch(i, { required: e.target.checked })}
                            className="h-4 w-4"
                          />
                        </>
                      )}
                    </td>

                    <td className="px-2 py-2">
                      {!locked && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                          className={touchButtonCls}
                          aria-label={`Remove ${singularize(label)} ${rowDescriptor}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
