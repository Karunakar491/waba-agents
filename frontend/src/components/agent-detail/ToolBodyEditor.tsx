import { useState } from 'react'
import type { BodyFieldRow } from './toolRequestDefinition'
import { parseBodyJson, bodyRowsToJson, InvalidBodyJsonError } from './toolRequestDefinition'
import { inputCls } from './toolEditorStyles'

const jsonBoxCls =
  'w-full rounded-lg border bg-background px-3 py-2.5 font-mono text-xs placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

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
  // The JSON textarea is its own piece of state, not derived live from `rows` on every
  // keystroke — otherwise a mid-edit invalid JSON ("{"query": ") would get clobbered back to
  // the last valid rows on every render. It's only synced from `rows` once, at mount, and
  // pushed back into `rows` on blur (parse succeeds) or left showing a visible error (parse
  // fails) — never silently discarded.
  const [jsonText, setJsonText] = useState(() => bodyRowsToJson(rows))
  const [jsonError, setJsonError] = useState<string | null>(null)

  function handleBlur() {
    if (!jsonText.trim()) {
      setRows(() => [])
      setJsonError(null)
      return
    }
    try {
      const parsed = parseBodyJson(jsonText, rows)
      setRows(() => parsed)
      setJsonError(null)
    } catch (err) {
      setJsonError(err instanceof InvalidBodyJsonError ? err.message : 'Could not parse this JSON.')
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-foreground">Request body</span>
      <p className="text-xs text-muted-foreground">
        Type an example of what the agent should send, e.g. <code>{'{"query": "TMT Bars"}'}</code>. Flat fields only —
        for a nested object or list, contact engineering.
      </p>
      <textarea
        rows={5}
        value={jsonText}
        disabled={disabled}
        onChange={(e) => setJsonText(e.target.value)}
        onBlur={handleBlur}
        placeholder={'{\n  "query": "TMT Bars"\n}'}
        spellCheck={false}
        className={`${jsonBoxCls} disabled:opacity-60`}
      />
      {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}

      {rows.length > 0 && (
        <div className="space-y-2 rounded-lg border p-2">
          {rows.map((row, i) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[6rem] rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">{row.key}</span>
              <span className="text-xs text-muted-foreground">{row.type}</span>
              <label className="sr-only" htmlFor={`body-${i}-description`}>Description for {row.key}</label>
              <input
                id={`body-${i}-description`}
                type="text"
                value={row.description}
                disabled={disabled}
                onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                placeholder="Description — the agent reads this to know what to put here"
                className={`${inputCls} min-w-[10rem] flex-1 disabled:opacity-60`}
              />
              <label className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={row.required}
                  disabled={disabled}
                  onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, required: e.target.checked } : r)))}
                  className="h-4 w-4 shrink-0"
                />
                Required
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
