import { Plus, Trash2 } from 'lucide-react'
import type { ParamRow, ParamType, FillMode } from './toolRequestDefinition'

const inputCls =
  'rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2'

const FILL_OPTIONS: { value: FillMode; label: string }[] = [
  { value: 'agent', label: 'The agent fills this in' },
  { value: 'fixed', label: 'Fixed value' },
  { value: 'WHATSAPP_PHONE_NUMBER', label: "Customer's WhatsApp number" },
  { value: 'WHATSAPP_IDENTITY_HASH', label: 'WhatsApp identity hash' },
  { value: 'WHATSAPP_CURRENT_STATUS_ID', label: 'Current status ID' },
]

export default function ToolParamsEditor({
  label,
  rows,
  setRows,
  lockedKeys = [],
  showAdd = true,
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
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-foreground">{label}</label>
        {showAdd && (
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { key: '', type: 'string', description: '', required: false, fill: 'agent', fixedValue: '' }])}
            className="flex items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add {label.toLowerCase()}
          </button>
        )}
      </div>
      {rows.map((row, i) => {
        const locked = lockedKeys.includes(row.key)
        return (
          <div key={i} className="space-y-1 rounded-lg border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={row.key}
                disabled={locked}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                placeholder="name"
                className={`${inputCls} min-w-[7rem] flex-1 disabled:opacity-60`}
              />
              <select
                value={row.type}
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
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.required}
                    onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, required: e.target.checked } : r)))}
                  />
                  Required
                </label>
              )}
              {!locked && (
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
                  aria-label={`Remove ${label.toLowerCase()} row`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <input
              type="text"
              value={row.description}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
              placeholder="Description — the agent reads this to know what to put here"
              className={`${inputCls} w-full`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={row.fill}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, fill: e.target.value as FillMode } : r)))}
                className={inputCls}
              >
                {FILL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {row.fill === 'fixed' && (
                <input
                  type="text"
                  value={row.fixedValue}
                  onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, fixedValue: e.target.value } : r)))}
                  placeholder="Fixed value"
                  className={`${inputCls} flex-1`}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
