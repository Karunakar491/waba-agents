import { Plus, Trash2 } from 'lucide-react'
import type { ParamRow, ParamType, FillMode } from './toolRequestDefinition'
import { inputCls, touchButtonCls, touchCheckboxCls } from './toolEditorStyles'

const FILL_OPTIONS: { value: FillMode; label: string }[] = [
  { value: 'agent', label: 'The agent fills this in' },
  { value: 'fixed', label: 'Fixed value' },
]
const ADVANCED_FILL_OPTIONS: { value: FillMode; label: string }[] = [
  { value: 'WHATSAPP_PHONE_NUMBER', label: "Customer's WhatsApp number" },
  { value: 'WHATSAPP_IDENTITY_HASH', label: 'WhatsApp identity hash (advanced)' },
  { value: 'WHATSAPP_CURRENT_STATUS_ID', label: 'Current conversation status ID (advanced)' },
]

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
            className="flex items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add {singularize(label)}
          </button>
        )}
      </div>
      {rows.map((row, i) => {
        const locked = lockedKeys.includes(row.key)
        const rowDescriptor = row.key.trim() || `row ${i + 1}`
        return (
          <div key={i} className="space-y-2 rounded-lg border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`${label}-${i}-key`}>{label} name</label>
              <input
                id={`${label}-${i}-key`}
                type="text"
                value={row.key}
                disabled={locked || disabled}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                placeholder="name"
                className={`${inputCls} min-w-[7rem] flex-1 disabled:opacity-60`}
              />
              <select
                aria-label={`${label} type`}
                value={row.type}
                disabled={disabled}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, type: e.target.value as ParamType } : r)))}
                className={inputCls}
              >
                {(['string', 'integer', 'number', 'boolean'] as ParamType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {locked ? (
                // Path parameters are always required — connector-tools.md: "Ignored for path
                // params (always required)." Showing a checkbox here would let the operator
                // toggle a control Meta silently ignores, which is exactly the class of lying
                // UI this task exists to eliminate. Static text only, no control.
                <span className="text-xs text-muted-foreground">Always required (path parameter)</span>
              ) : (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.required}
                    disabled={disabled}
                    onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, required: e.target.checked } : r)))}
                    className={touchCheckboxCls}
                  />
                  Required
                </label>
              )}
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
            </div>
            <label className="sr-only" htmlFor={`${label}-${i}-description`}>{label} description</label>
            <input
              id={`${label}-${i}-description`}
              type="text"
              value={row.description}
              disabled={disabled}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
              placeholder="Description — the agent reads this to know what to put here"
              className={`${inputCls} w-full disabled:opacity-60`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor={`${label}-${i}-fill`}>Who fills this in?</label>
              <select
                id={`${label}-${i}-fill`}
                value={row.fill}
                disabled={disabled}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, fill: e.target.value as FillMode } : r)))}
                className={inputCls}
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
                  <label className="sr-only" htmlFor={`${label}-${i}-fixedvalue`}>Fixed value</label>
                  <input
                    id={`${label}-${i}-fixedvalue`}
                    type="text"
                    value={row.fixedValue}
                    disabled={disabled}
                    onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, fixedValue: e.target.value } : r)))}
                    placeholder="Fixed value"
                    className={`${inputCls} flex-1 disabled:opacity-60`}
                  />
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
