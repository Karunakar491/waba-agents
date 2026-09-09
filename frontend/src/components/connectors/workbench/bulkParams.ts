import type { ParamRow } from '../../agent-detail/toolRequestDefinition'

/**
 * Parameters as text, one per line — the Bulk mode in `design/BulkEdit.dc.html`.
 *
 * `key: source  // description`
 *
 * Nine rows of dropdowns become nine lines of typing, and "switching back to
 * Table loses nothing", which is the requirement that shapes this file: the
 * text has to carry everything a row carries, so both directions are lossless
 * for anything the table can express.
 *
 * `source` is one of:
 *   - `agent`               the model fills it
 *   - `{{MACRO}}`           one of Meta's variables
 *   - anything else         a fixed value, verbatim
 *
 * Type is not in the syntax. It is inferred from a fixed value — `10` is an
 * integer, `true` a boolean — and left alone otherwise, because typing
 * `limit: 10 integer` to say what `10` obviously is would be worse than the
 * dropdown it replaces.
 */

const MACRO = /^\{\{[A-Z_]+\}\}$/

/** Serialises rows to text. */
export function paramsToText(rows: ParamRow[]): string {
  return rows
    .filter((row) => row.key.trim())
    .map((row) => {
      const source =
        row.fill === 'agent'
          ? 'agent'
          : row.fixedValue.trim() || 'agent'
      const description = row.description.trim()
      return `${row.key.trim()}: ${source}${description ? `  // ${description}` : ''}`
    })
    .join('\n')
}

/**
 * Parses text back to rows.
 *
 * Existing rows are passed in so that anything the syntax cannot express —
 * an explicit type, the enum a "One of" row carries — survives a round trip
 * for keys that were already there. A key the text drops is dropped; a key it
 * adds is new.
 */
export function textToParams(text: string, existing: ParamRow[]): ParamRow[] {
  const byKey = new Map(existing.map((row) => [row.key.trim(), row]))

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    // A line with no colon is a key on its own — treat it as agent-filled
    // rather than discarding what someone typed.
    .map((line) => {
      const commentAt = line.indexOf('//')
      const description = commentAt >= 0 ? line.slice(commentAt + 2).trim() : ''
      const head = (commentAt >= 0 ? line.slice(0, commentAt) : line).trim()

      const colonAt = head.indexOf(':')
      const key = (colonAt >= 0 ? head.slice(0, colonAt) : head).trim()
      const source = colonAt >= 0 ? head.slice(colonAt + 1).trim() : 'agent'
      if (!key) return null

      const previous = byKey.get(key)
      const agentFilled = source === '' || source.toLowerCase() === 'agent'

      return {
        key,
        type: previous?.type ?? inferType(agentFilled ? '' : source),
        description: description || previous?.description || '',
        required: previous?.required ?? false,
        fill: agentFilled ? 'agent' : 'fixed',
        fixedValue: agentFilled ? '' : source,
      } as ParamRow
    })
    .filter((row): row is ParamRow => row !== null)
}

/**
 * The type a fixed value obviously is.
 *
 * Deliberately shallow: a macro is a string because Meta substitutes text, and
 * anything not plainly a number or a boolean is a string. Guessing harder would
 * silently change a type someone had set in the table.
 */
function inferType(value: string): ParamRow['type'] {
  if (!value) return 'string'
  if (MACRO.test(value)) return 'string'
  if (/^(true|false)$/i.test(value)) return 'boolean'
  if (/^-?\d+$/.test(value)) return 'integer'
  if (/^-?\d*\.\d+$/.test(value)) return 'number'
  return 'string'
}
