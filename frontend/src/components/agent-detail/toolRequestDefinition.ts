export type ParamType = 'string' | 'integer' | 'number' | 'boolean'
export type FillMode = 'agent' | 'fixed' | 'WHATSAPP_PHONE_NUMBER' | 'WHATSAPP_IDENTITY_HASH' | 'WHATSAPP_CURRENT_STATUS_ID'

export interface ParamRow {
  key: string
  type: ParamType
  description: string
  required: boolean
  fill: FillMode
  fixedValue: string // used only when fill === 'fixed'
}

export interface BodyFieldRow {
  key: string
  type: ParamType
  description: string
  required: boolean
  fill: FillMode
  fixedValue: string // used only when fill === 'fixed'
}

export interface ToolFormState {
  method: string
  path: string
  pathParams: ParamRow[]
  queryParams: ParamRow[]
  headerParams: ParamRow[]
  bodyFields: BodyFieldRow[]
}

export interface RequestDefinition {
  method: string
  path: string
  path_parameters?: Record<string, unknown>
  query_parameters?: Record<string, unknown>
  headers?: Record<string, unknown>
  body?: { content_type: 'application/json'; params: Record<string, unknown>; required?: string[] }
}

/**
 * Blank-key rows are a validation failure, never a silent skip — this project has already
 * shipped one silent-data-loss bug from a "quietly drop the incomplete row" call (the
 * CAROUSEL PHONE_NUMBER write path, 2026-08-20). The modal's handleSubmit must catch this
 * and show it as a visible message; buildRequestDefinition itself never guesses.
 */
export class IncompleteRowError extends Error {
  constructor(section: string) {
    super(`${section}: every row needs a name before this tool can be saved.`)
    this.name = 'IncompleteRowError'
  }
}

/**
 * The `binding` half of a node, shared by path/query/header params and body fields alike.
 * Meta models both with the same ParameterBinding (`docs/meta-api/connector-tools.md`), so
 * they get one implementation here rather than two that can drift apart.
 * Returns undefined for an agent-filled field — Meta's rule is to omit `binding` entirely
 * rather than send a null one.
 */
function bindingFor(fill: FillMode, fixedValue: string): Record<string, unknown> | undefined {
  if (fill === 'fixed') return { kind: 'default', value: fixedValue.trim() }
  if (fill !== 'agent') return { kind: 'macro', macro: fill }
  return undefined
}

function buildParamNode(row: ParamRow): Record<string, unknown> {
  const node: Record<string, unknown> = { type: row.type }
  if (row.description.trim()) node.description = row.description.trim()
  if (row.required) node.required = true
  const binding = bindingFor(row.fill, row.fixedValue)
  if (binding) node.binding = binding
  return node
}

/** The inverse of bindingFor, for prefilling the editor from a tool already saved on Meta. */
function fillFromBinding(binding?: { kind?: string; value?: string; macro?: string }): {
  fill: FillMode
  fixedValue: string
} {
  if (binding?.kind === 'default') return { fill: 'fixed', fixedValue: binding.value ?? '' }
  if (binding?.kind === 'macro' && binding.macro) return { fill: binding.macro as FillMode, fixedValue: '' }
  return { fill: 'agent', fixedValue: '' }
}

function rowsToRecord(rows: ParamRow[], section: string): Record<string, unknown> | undefined {
  if (rows.length === 0) return undefined
  if (rows.some((row) => !row.key.trim())) throw new IncompleteRowError(section)
  const record: Record<string, unknown> = {}
  for (const row of rows) {
    record[row.key.trim()] = buildParamNode(row)
  }
  return record
}

export function buildRequestDefinition(form: ToolFormState): RequestDefinition {
  const def: RequestDefinition = { method: form.method, path: form.path }

  const pathParameters = rowsToRecord(form.pathParams, 'Path parameters')
  if (pathParameters) def.path_parameters = pathParameters

  const queryParameters = rowsToRecord(form.queryParams, 'Query parameters')
  if (queryParameters) def.query_parameters = queryParameters

  const headers = rowsToRecord(form.headerParams, 'Headers')
  if (headers) def.headers = headers

  if (form.bodyFields.length > 0 && (form.method === 'POST' || form.method === 'PUT' || form.method === 'PATCH')) {
    if (form.bodyFields.some((f) => !f.key.trim())) throw new IncompleteRowError('Request body fields')
    const params: Record<string, unknown> = {}
    const required: string[] = []
    for (const field of form.bodyFields) {
      const key = field.key.trim()
      const binding = bindingFor(field.fill, field.fixedValue)
      params[key] = {
        type: field.type,
        ...(field.description.trim() ? { description: field.description.trim() } : {}),
        // `required` is deliberately NOT set on the node here — for a body it belongs in
        // body.required below as a string[]. Putting it on the node is the exact defect
        // this editor exists to prevent.
        ...(binding ? { binding } : {}),
      }
      if (field.required) required.push(key)
    }
    def.body = {
      content_type: 'application/json',
      params,
      ...(required.length > 0 ? { required } : {}),
    }
  }

  return def
}

function recordToRows(record: Record<string, unknown> | undefined): ParamRow[] {
  if (!record) return []
  return Object.entries(record).map(([key, raw]) => {
    const node = raw as { type?: ParamType; description?: string; required?: boolean; binding?: { kind: string; value?: string; macro?: string } }
    return {
      key,
      type: node.type ?? 'string',
      description: node.description ?? '',
      required: node.required ?? false,
      ...fillFromBinding(node.binding),
    }
  })
}

export function parseRequestDefinition(def: RequestDefinition): ToolFormState {
  const requiredSet = new Set(def.body?.required ?? [])
  const bodyFields: BodyFieldRow[] = def.body
    ? Object.entries(def.body.params).map(([key, raw]) => {
        const node = raw as { type?: ParamType; description?: string; binding?: { kind: string; value?: string; macro?: string } }
        return {
          key,
          type: node.type ?? 'string',
          description: node.description ?? '',
          required: requiredSet.has(key),
          ...fillFromBinding(node.binding),
        }
      })
    : []

  return {
    method: def.method,
    path: def.path,
    pathParams: recordToRows(def.path_parameters),
    queryParams: recordToRows(def.query_parameters),
    headerParams: recordToRows(def.headers),
    bodyFields,
  }
}

/** One line per param showing what actually gets sent — value literal if fixed, macro name if
 * bound to one, or "<agent fills in>" if the agent decides at conversation time. Lets an operator
 * see the real request shape without reading JSON. */
function previewValue(row: ParamRow): string {
  if (row.fill === 'fixed') return row.fixedValue.trim() || '(empty)'
  if (row.fill === 'agent') return '<agent fills in>'
  return `<${row.fill}>`
}

export function buildPreviewUrl(method: string, path: string, pathParams: ParamRow[], queryParams: ParamRow[]): string {
  let resolvedPath = path.trim()
  for (const row of pathParams) {
    resolvedPath = resolvedPath.replace(`{${row.key}}`, previewValue(row))
  }
  const query = queryParams
    .filter((row) => row.key.trim())
    .map((row) => `${row.key.trim()}=${previewValue(row)}`)
    .join('&')
  return `${method} ${resolvedPath}${query ? `?${query}` : ''}`
}

/**
 * Parses a flat example JSON object into body field rows, inferring type from each value's JS
 * type. Nested objects/arrays are rejected — the whole body-field model (and Meta's own schema:
 * body.params is a flat map, not a nested schema) is flat-fields-only, so a nested value here
 * would silently need to collapse to something wrong. Existing rows are reused by key so
 * descriptions/required flags typed in before aren't lost when the JSON is tweaked.
 */
export class InvalidBodyJsonError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidBodyJsonError'
  }
}

function inferParamType(value: unknown): ParamType {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return 'string'
}

export function parseBodyJson(jsonText: string, existingRows: BodyFieldRow[]): BodyFieldRow[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new InvalidBodyJsonError('Not valid JSON — check for a missing quote, brace, or comma.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidBodyJsonError('The body must be a flat JSON object, e.g. {"query": "TMT Bars"}.')
  }
  const existingByKey = new Map(existingRows.map((r) => [r.key, r]))
  return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      throw new InvalidBodyJsonError(`"${key}" is a nested object or list — flat fields only. For a nested shape, contact engineering.`)
    }
    const existing = existingByKey.get(key)
    return {
      key,
      type: inferParamType(value),
      description: existing?.description ?? '',
      required: existing?.required ?? false,
      // Carried over for the same reason as description/required: retyping the example JSON
      // must not silently revert a field from "Fixed value" back to agent-filled.
      fill: existing?.fill ?? 'agent',
      fixedValue: existing?.fixedValue ?? '',
    }
  })
}

/** A non-empty example value per field, not a blank/zero placeholder — the operator should see
 * something submittable, not "{}" or {"query": ""} with no hint of what belongs there.
 * A fixed field shows its actual value, coerced to the field's type, because that is literally
 * what gets sent — a generic placeholder there would misrepresent the request. */
function exampleValueFor(row: BodyFieldRow): unknown {
  if (row.fill === 'fixed' && row.fixedValue.trim()) {
    const raw = row.fixedValue.trim()
    if (row.type === 'boolean') return raw === 'true'
    if (row.type === 'integer' || row.type === 'number') {
      const n = Number(raw)
      return Number.isNaN(n) ? raw : n
    }
    return raw
  }
  // Tested explicitly rather than as "not fixed and not agent": that negative form turned a
  // row arriving without a `fill` into the literal string "<undefined>" in the example JSON.
  if (row.fill && row.fill.startsWith('WHATSAPP_')) return `<${row.fill}>`
  if (row.type === 'boolean') return true
  if (row.type === 'integer') return 1
  if (row.type === 'number') return 1.5
  return 'TMT Bars'
}

export function bodyRowsToJson(rows: BodyFieldRow[]): string {
  const example: Record<string, unknown> = {}
  for (const row of rows) {
    example[row.key] = exampleValueFor(row)
  }
  return JSON.stringify(example, null, 2)
}

export function extractPathParamNames(path: string): string[] {
  const matches = path.matchAll(/\{([^}]+)\}/g)
  // Deduped: a duplicate placeholder like /orders/{id}/items/{id} must yield one row, not
  // two — two rows sharing a locked key would silently collapse to last-write-wins in
  // setPathParamRows' merge, discarding an edit to the first one.
  return Array.from(new Set(Array.from(matches, (m) => m[1])))
}
