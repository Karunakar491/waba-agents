import { Plus, Trash2 } from 'lucide-react'
import type { BodyFieldRow, ParamType } from './toolRequestDefinition'

const inputCls =
  'rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2'

export default function ToolBodyEditor({
  rows,
  setRows,
}: {
  rows: BodyFieldRow[]
  setRows: (updater: (prev: BodyFieldRow[]) => BodyFieldRow[]) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-foreground">Request body fields</label>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { key: '', type: 'string', description: '', required: false }])}
          className="flex items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" /> Add body field
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Flat fields only — for a nested object or list, contact engineering. Each field is filled in by the agent from the conversation.
      </p>
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
          <input
            type="text"
            value={row.key}
            onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
            placeholder="field name"
            className={`${inputCls} min-w-[7rem] flex-1`}
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
          <input
            type="text"
            value={row.description}
            onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
            placeholder="Description"
            className={`${inputCls} min-w-[8rem] flex-1`}
          />
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={row.required}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, required: e.target.checked } : r)))}
            />
            Required
          </label>
          <button
            type="button"
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            className="rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            aria-label="Remove body field"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
