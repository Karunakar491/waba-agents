import { useState } from 'react'
import type { BodyFieldRow, FillMode } from './toolRequestDefinition'
import { parseBodyJson, bodyRowsToJson, InvalidBodyJsonError, holdsChildren } from './toolRequestDefinition'
import { inputCls } from './toolEditorStyles'
import { FILL_OPTIONS, ADVANCED_FILL_OPTIONS } from './toolFillOptions'

const jsonBoxCls =
  'w-full rounded-lg border bg-background px-3 py-2.5 font-mono text-xs placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * Replace one field somewhere in the tree, addressed by its index path.
 *
 * Rows are rebuilt rather than mutated, so React sees new objects all the way
 * up the branch that changed and nothing below it re-renders by surprise.
 */
function updateAt(
  rows: BodyFieldRow[],
  path: number[],
  patch: Partial<BodyFieldRow>,
): BodyFieldRow[] {
  const [head, ...rest] = path
  return rows.map((row, i) => {
    if (i !== head) return row
    if (rest.length === 0) return { ...row, ...patch }
    return { ...row, children: updateAt(row.children ?? [], rest, patch) }
  })
}

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
        Paste an example of the JSON this endpoint expects — nested objects and lists included.
        Each field gets a row below where you choose whether the agent fills it in or it always
        sends the same value.
      </p>
      <textarea
        rows={5}
        value={jsonText}
        disabled={disabled}
        onChange={(e) => setJsonText(e.target.value)}
        onBlur={handleBlur}
        placeholder={'{\n  "customer": { "id": 1024 },\n  "lines": [{ "sku": "TMT-12", "qty": 2 }]\n}'}
        spellCheck={false}
        className={`${jsonBoxCls} disabled:opacity-60`}
      />
      {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}

      {rows.length > 0 && (
        <div className="space-y-2 rounded-lg border p-2">
          {rows.map((row, i) => (
            <FieldRow
              key={row.key}
              row={row}
              path={[i]}
              depth={0}
              disabled={disabled}
              setRows={setRows}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * One field, and its children if it has any.
 *
 * A container — an object, or a list of objects — gets no "who fills this in"
 * control and no fixed value, because there is nothing to fill: the agent
 * supplies the leaves and Meta assembles the shape around them. Showing a fill
 * selector there would offer a choice that has no meaning.
 *
 * Required is only offered at the top level. Meta carries body required-ness in
 * `body.required` as a top-level string array, and there is no verified place to
 * say it deeper — so rather than render a checkbox that silently does nothing,
 * nested rows say where required-ness lives.
 */
function FieldRow({
  row,
  path,
  depth,
  disabled,
  setRows,
}: {
  row: BodyFieldRow
  path: number[]
  depth: number
  disabled: boolean
  setRows: (updater: (prev: BodyFieldRow[]) => BodyFieldRow[]) => void
}) {
  const id = path.join('-')
  const patch = (p: Partial<BodyFieldRow>) => setRows((prev) => updateAt(prev, path, p))
  const container = holdsChildren(row)
  const typeLabel =
    row.type === 'array' ? `list of ${row.itemType ?? 'string'}` : row.type

  return (
    <div className={depth > 0 ? 'border-l pl-3' : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[6rem] rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
          {row.key}
        </span>
        <span className="text-xs text-muted-foreground">{typeLabel}</span>

        {!container && (
          <>
            <label className="sr-only" htmlFor={`body-${id}-fill`}>
              Who fills in {row.key}
            </label>
            <select
              id={`body-${id}-fill`}
              value={row.fill}
              disabled={disabled}
              onChange={(e) => patch({ fill: e.target.value as FillMode })}
              className={`${inputCls} disabled:opacity-60`}
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
                <label className="sr-only" htmlFor={`body-${id}-fixedvalue`}>
                  Fixed value for {row.key}
                </label>
                <input
                  id={`body-${id}-fixedvalue`}
                  type="text"
                  value={row.fixedValue}
                  disabled={disabled}
                  onChange={(e) => patch({ fixedValue: e.target.value })}
                  placeholder="Value"
                  className={`${inputCls} min-w-[7rem] disabled:opacity-60`}
                />
              </>
            )}
          </>
        )}

        <label className="sr-only" htmlFor={`body-${id}-description`}>
          Description for {row.key}
        </label>
        <input
          id={`body-${id}-description`}
          type="text"
          value={row.description}
          disabled={disabled}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder={
            container
              ? 'Description — what this part of the body represents'
              : 'Description — the agent reads this to know what to put here'
          }
          className={`${inputCls} min-w-[10rem] flex-1 disabled:opacity-60`}
        />

        {depth === 0 ? (
          <label className="flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground">
            <input
              id={`body-${id}-required`}
              type="checkbox"
              checked={row.required}
              disabled={disabled}
              onChange={(e) => patch({ required: e.target.checked })}
              className="h-4 w-4 shrink-0"
            />
            Required
          </label>
        ) : null}
      </div>

      {container && (
        <div className="mt-2 space-y-2 pl-3">
          {(row.children ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing inside <span className="font-mono">{row.key}</span> yet — add it to the example
              JSON above.
            </p>
          ) : (
            (row.children ?? []).map((child, i) => (
              <FieldRow
                key={child.key}
                row={child}
                path={[...path, i]}
                depth={depth + 1}
                disabled={disabled}
                setRows={setRows}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
