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

interface FlatField {
  row: BodyFieldRow
  /** Index path into the nested rows, for writing back. */
  path: number[]
  /** Dotted path as the user reads it: `customer.id`, `lines[].sku`. */
  label: string
  depth: number
}

/**
 * The tree, flattened, each field carrying the path you would use to talk
 * about it.
 *
 * A list of objects contributes `lines[]` and then `lines[].sku`, because that
 * is what the field is: one per item. A list of scalars is a leaf — `tags[]` —
 * with nothing underneath.
 */
function flatten(rows: BodyFieldRow[], prefix = '', path: number[] = []): FlatField[] {
  return rows.flatMap((row, i) => {
    const isList = row.type === 'array'
    const label = `${prefix}${row.key}${isList ? '[]' : ''}`
    const here: FlatField = { row, path: [...path, i], label, depth: path.length }
    if (!holdsChildren(row)) return [here]
    return [here, ...flatten(row.children ?? [], `${label}.`, [...path, i])]
  })
}

function typeLabel(row: BodyFieldRow): string {
  return row.type === 'array' ? `list of ${row.itemType ?? 'string'}` : row.type
}

/**
 * The request body: an example of the JSON, and a table of what each field is.
 *
 * The founder: "If a user adds some body, Lets show the table below the body
 * section or something which is for fields mapping and all."
 *
 * The JSON box stays because it is how you state a shape quickly — paste what
 * the endpoint expects and every field appears. What replaced the indented tree
 * below it is one flat table, each row named by its dotted path. The tree
 * repeated the shape the JSON above already showed, and at two levels deep the
 * indentation was doing the work a `customer.address.city` label does better.
 *
 * Container rows stay in the table: their description really is sent (see
 * `buildBodyNode`). They get no fill control, because there is nothing to fill
 * — the agent supplies the leaves and Meta assembles the shape around them.
 */
export default function ToolBodyEditor({
  rows,
  setRows,
  disabled = false,
}: {
  rows: BodyFieldRow[]
  setRows: (updater: (prev: BodyFieldRow[]) => BodyFieldRow[]) => void
  /** True while the form is saving — every control here freezes. */
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

  const fields = flatten(rows)

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-foreground">Request body</span>
        <p className="text-xs text-muted-foreground">
          Paste an example of the JSON this endpoint expects — nested objects and lists included.
          Every field appears in the table below.
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
      </div>

      {fields.length > 0 && (
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-foreground">Fields</span>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="w-1/4 px-3 py-2 font-medium">Field</th>
                  <th className="w-28 px-3 py-2 font-medium">Type</th>
                  <th className="w-1/4 px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="w-20 px-3 py-2 text-center font-medium">Required</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(({ row, path, label, depth }) => {
                  const id = `body-${path.join('-')}`
                  const patch = (p: Partial<BodyFieldRow>) =>
                    setRows((prev) => updateAt(prev, path, p))
                  const container = holdsChildren(row)
                  return (
                    <tr key={label} className="border-b align-top last:border-b-0">
                      <td className="px-3 py-2">
                        {/* The full path, so a row means the same thing read on
                            its own as it does in context. */}
                        <span
                          className={`font-mono ${container ? 'text-muted-foreground' : 'text-foreground'}`}
                        >
                          {label}
                        </span>
                      </td>

                      <td className="px-3 py-2 text-muted-foreground">{typeLabel(row)}</td>

                      <td className="px-3 py-2">
                        {container ? (
                          <span
                            className="text-muted-foreground"
                            title="Meta assembles this from the fields inside it"
                          >
                            built from its fields
                          </span>
                        ) : (
                          <>
                            <label className="sr-only" htmlFor={`${id}-fill`}>
                              Who fills in {label}
                            </label>
                            <select
                              id={`${id}-fill`}
                              value={row.fill}
                              disabled={disabled}
                              onChange={(e) => patch({ fill: e.target.value as FillMode })}
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
                                  Fixed value for {label}
                                </label>
                                <input
                                  id={`${id}-fixedvalue`}
                                  type="text"
                                  value={row.fixedValue}
                                  disabled={disabled}
                                  onChange={(e) => patch({ fixedValue: e.target.value })}
                                  placeholder="Value"
                                  className={`${inputCls} mt-1.5 w-full disabled:opacity-60`}
                                />
                              </>
                            )}
                          </>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <label className="sr-only" htmlFor={`${id}-description`}>
                          Description for {label}
                        </label>
                        <input
                          id={`${id}-description`}
                          type="text"
                          value={row.description}
                          disabled={disabled}
                          onChange={(e) => patch({ description: e.target.value })}
                          placeholder={
                            container
                              ? 'What this part of the body represents'
                              : 'What the agent should put here'
                          }
                          className={`${inputCls} w-full disabled:opacity-60`}
                        />
                      </td>

                      <td className="px-3 py-2 text-center">
                        {depth === 0 ? (
                          <>
                            <label className="sr-only" htmlFor={`${id}-required`}>
                              {label} is required
                            </label>
                            <input
                              id={`${id}-required`}
                              type="checkbox"
                              checked={row.required}
                              disabled={disabled}
                              onChange={(e) => patch({ required: e.target.checked })}
                              className="h-4 w-4"
                            />
                          </>
                        ) : (
                          // Meta carries body required-ness in `body.required` as a
                          // top-level array, with no verified place to say it deeper.
                          // A checkbox here would silently do nothing.
                          <span
                            className="text-muted-foreground"
                            title="Meta only records required-ness for top-level body fields"
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
