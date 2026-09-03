import { Plus, Trash2 } from 'lucide-react'
import type { ParamRow, ParamType, FillMode } from './toolRequestDefinition'
import { inputCls, touchButtonCls, addButtonCls, idSlug } from './toolEditorStyles'
import { FILL_OPTIONS, ADVANCED_FILL_OPTIONS } from './toolFillOptions'

/** "Query parameters" -> "query parameter", "Headers" -> "header" — singular for the Add-row button copy. */
function singularize(label: string): string {
  return label.toLowerCase().replace(/s$/, '')
}

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
   * false for path-parameter usage: that row list is fully derived from the Path field
   * (see AddToolModal), so an "Add" button there would append a row with a blank key that
   * gets silently discarded on the next render (its key can never match a real path token) —
   * a phantom control. Path params gain/lose rows only by editing the Path field itself.
   */
  showAdd?: boolean
  /** True while the form is saving — every control here freezes, matching the modal's own disable-on-save pattern. */
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {showAdd && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRows((prev) => [...prev, { key: '', type: 'string', description: '', required: false, fill: 'agent', fixedValue: '' }])}
            className={addButtonCls}
          >
            <Plus className="h-3.5 w-3.5" /> Add {singularize(label)}
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="w-1/4 px-3 py-2 font-medium">Key</th>
                <th className="w-1/3 px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="w-11 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const locked = lockedKeys.includes(row.key)
                const rowDescriptor = row.key.trim() || `row ${i + 1}`
                return (
                  <tr key={i} className="border-b align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`${idSlug(label)}-${i}-key`}>{label} name</label>
                      <input
                        id={`${idSlug(label)}-${i}-key`}
                        type="text"
                        value={row.key}
                        disabled={locked || disabled}
                        onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                        placeholder="Key"
                        className={`${inputCls} w-full disabled:opacity-60`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`${idSlug(label)}-${i}-fill`}>Who fills in {rowDescriptor}</label>
                      <select
                        id={`${idSlug(label)}-${i}-fill`}
                        value={row.fill}
                        disabled={disabled}
                        onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, fill: e.target.value as FillMode } : r)))}
                        className={`${inputCls} w-full`}
                      >
                        {FILL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                        <optgroup label="Advanced (rarely needed)">
                          {ADVANCED_FILL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </optgroup>
                      </select>
                      {row.fill === 'fixed' && (
                        <>
                          <label className="sr-only" htmlFor={`${idSlug(label)}-${i}-fixedvalue`}>Fixed value for {rowDescriptor}</label>
                          <input
                            id={`${idSlug(label)}-${i}-fixedvalue`}
                            type="text"
                            value={row.fixedValue}
                            disabled={disabled}
                            onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, fixedValue: e.target.value } : r)))}
                            placeholder="Value"
                            className={`${inputCls} mt-1.5 w-full disabled:opacity-60`}
                          />
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`${idSlug(label)}-${i}-description`}>{label} description</label>
                      <input
                        id={`${idSlug(label)}-${i}-description`}
                        type="text"
                        value={row.description}
                        disabled={disabled}
                        onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                        placeholder="Description — the agent reads this to know what to put here"
                        className={`${inputCls} w-full disabled:opacity-60`}
                      />
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                        <label htmlFor={`${idSlug(label)}-${i}-type`} className="sr-only">{label} type</label>
                        <select
                          id={`${idSlug(label)}-${i}-type`}
                          value={row.type}
                          disabled={disabled}
                          onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, type: e.target.value as ParamType } : r)))}
                          className={`${inputCls} px-2 py-1`}
                        >
                          {(['string', 'integer', 'number', 'boolean'] as ParamType[]).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        {locked ? (
                          // Path parameters are always required — connector-tools.md: "Ignored for path
                          // params (always required)." Showing a checkbox here would let the operator
                          // toggle a control Meta silently ignores.
                          <span>Always required (path parameter)</span>
                        ) : (
                          <label className="flex min-h-11 items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={row.required}
                              disabled={disabled}
                              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, required: e.target.checked } : r)))}
                              className="h-4 w-4 shrink-0"
                            />
                            Required
                          </label>
                        )}
                      </div>
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
