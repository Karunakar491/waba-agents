import { useState, type ReactNode } from 'react'

/**
 * The connector's own fields, as the property table in the canvas.
 *
 * Measured from `design/_chrome.txt` and `Main.dc.html` rather than styled by
 * eye: a 172px label column, 44px rows, one 1px divider between them, a 12px
 * radius on the border, 13px body text, 12px mono for anything literal.
 *
 * It replaced a stack of seven labelled form fields with a banner over them,
 * which was the whole reason the Actions table fell below the fold on a
 * 900px screen — "nothing hidden" had become hidden by scroll.
 *
 * Editing is in place. Click a value, type, and leaving the field saves it:
 * the table IS the form, so there is no separate edit mode to enter and no
 * Save button competing with the one on an action. A row that is showing an
 * input looks like an input; a row that is not looks like a value.
 */

export interface PropertyRow {
  label: string
  /** The stored value. Empty renders as the placeholder, greyed. */
  value: string
  /** Shown greyed when the value is empty — what the field is for. */
  placeholder: string
  /** Rendered instead of the raw value when not editing (tags as chips, say). */
  display?: ReactNode
  /** Fixed options make the row a select rather than a text field. */
  options?: { value: string; label: string }[]
  multiline?: boolean
  mono?: boolean
  /** Absent = the row is a fact, not a setting, and is never editable. */
  onChange?: (value: string) => void
}

export default function PropertyTable({
  rows,
  disabled,
}: {
  rows: PropertyRow[]
  disabled?: boolean
}) {
  // Which row is open for editing, by label. One at a time: two open inputs
  // read as a form, which is the pattern this replaced.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  function open(row: PropertyRow) {
    if (!row.onChange || disabled) return
    setEditing(row.label)
    setDraft(row.value)
  }

  function commit(row: PropertyRow) {
    setEditing(null)
    // Only when it actually changed, so tabbing through the table does not
    // fire a save per row.
    if (draft !== row.value) row.onChange?.(draft)
  }

  return (
    <div className="max-w-[980px] overflow-hidden rounded-xl border">
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row, i) => {
            const last = i === rows.length - 1
            const isEditing = editing === row.label
            const editable = !!row.onChange && !disabled

            return (
              <tr key={row.label} className={last ? '' : 'border-b'}>
                <th
                  scope="row"
                  className="h-11 w-[172px] px-4 text-left align-middle text-xs font-normal
                    text-muted-foreground"
                >
                  {row.label}
                </th>
                <td className="px-4 py-1.5 align-middle text-sm">
                  {isEditing ? (
                    row.options ? (
                      <select
                        autoFocus
                        aria-label={row.label}
                        value={draft}
                        onChange={(e) => {
                          // A select has no meaningful blur-to-save: choosing
                          // an option IS the decision.
                          setEditing(null)
                          if (e.target.value !== row.value) row.onChange?.(e.target.value)
                        }}
                        className="w-full max-w-md rounded-md border bg-background px-2 py-1 text-sm
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {row.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : row.multiline ? (
                      <textarea
                        autoFocus
                        rows={3}
                        aria-label={row.label}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit(row)}
                        className="w-full resize-y rounded-md border bg-background px-2 py-1 text-sm
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    ) : (
                      <input
                        autoFocus
                        type="text"
                        aria-label={row.label}
                        value={draft}
                        spellCheck={false}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit(row)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        className={
                          'w-full rounded-md border bg-background px-2 py-1 text-sm ' +
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
                          (row.mono ? 'font-mono text-xs' : '')
                        }
                      />
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => open(row)}
                      disabled={!editable}
                      title={editable ? `Edit ${row.label.toLowerCase()}` : undefined}
                      className={
                        'block w-full truncate text-left ' +
                        (editable ? 'cursor-text hover:text-accent-teal-solid' : 'cursor-default') +
                        (row.mono ? ' font-mono text-xs' : '')
                      }
                    >
                      {row.display ??
                        (row.value ? (
                          <span className="text-foreground">{row.value}</span>
                        ) : (
                          <span className="text-muted-foreground">{row.placeholder}</span>
                        ))}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
