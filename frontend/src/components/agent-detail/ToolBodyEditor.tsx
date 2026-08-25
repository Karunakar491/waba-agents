import { Plus, Trash2 } from 'lucide-react'
import type { BodyFieldRow, ParamType } from './toolRequestDefinition'
import { inputCls, touchButtonCls, touchCheckboxCls } from './toolEditorStyles'

export default function ToolBodyEditor({
  rows,
  setRows,
  disabled = false,
}: {
  rows: BodyFieldRow[]
  setRows: (updater: (prev: BodyFieldRow[]) => BodyFieldRow[]) => void
  /** True while the form is saving — every control here freezes, matching the modal's own disable-on-save pattern. */
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="block text-xs font-medium text-foreground">Request body fields</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setRows((prev) => [...prev, { key: '', type: 'string', description: '', required: false }])}
          className="flex items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" /> Add body field
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Flat fields only — for a nested object or list, contact engineering. Each field is filled in by the agent from the conversation.
      </p>
      {rows.map((row, i) => {
        const rowDescriptor = row.key.trim() || `row ${i + 1}`
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <label className="sr-only" htmlFor={`body-${i}-key`}>Body field name</label>
            <input
              id={`body-${i}-key`}
              type="text"
              value={row.key}
              disabled={disabled}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
              placeholder="field name"
              className={`${inputCls} min-w-[7rem] flex-1 disabled:opacity-60`}
            />
            <select
              aria-label="Body field type"
              value={row.type}
              disabled={disabled}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, type: e.target.value as ParamType } : r)))}
              className={inputCls}
            >
              {(['string', 'integer', 'number', 'boolean'] as ParamType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`body-${i}-description`}>Body field description</label>
            <input
              id={`body-${i}-description`}
              type="text"
              value={row.description}
              disabled={disabled}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
              placeholder="Description"
              className={`${inputCls} min-w-[8rem] flex-1 disabled:opacity-60`}
            />
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
            <button
              type="button"
              disabled={disabled}
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              className={touchButtonCls}
              aria-label={`Remove body field ${rowDescriptor}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
