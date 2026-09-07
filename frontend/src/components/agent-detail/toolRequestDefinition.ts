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

/**
 * A body field may be a scalar, an object, or a list — unlike a query or path
 * parameter, which Meta restricts to scalars.
 */
export type BodyFieldType = ParamType | 'object' | 'array'

export interface BodyFieldRow {
  key: string
  type: BodyFieldType
  description: string
  required: boolean
  fill: FillMode
  fixedValue: string // used only when fill === 'fixed'
  /** For `array`: what each item is. Defaults to 'string'. */
  itemType?: BodyFieldType
  /** For `object`, and for an `array` of objects: the fields inside. */
  children?: BodyFieldRow[]
}

/** A field that contains other fields, so the editor knows to show them. */
export function holdsChildren(row: BodyFieldRow): boolean {
  return row.type === 'object' || (row.type === 'array' && row.itemType === 'object')
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
/**
 * Which methods actually deliver a request body, checked on the wire against
 * httpbin through Meta's own runtime on 2026-09-04 — not assumed from the verb:
 *
 *   POST / PUT / PATCH   body delivered
 *   DELETE               body delivered  ← we used to refuse this
 *   GET                  body silently dropped by Meta, so offering it would lie
 *
 * A DELETE that takes a body is ordinary (bulk delete by id list). Blocking it
 * meant such an API could not be configured at all, with nothing saying why.
 */
export function methodSendsBody(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
}

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

/** Blank keys anywhere in the tree, not just at the top. */
function assertKeysPresent(rows: BodyFieldRow[]): void {
  for (const row of rows) {
    if (!row.key.trim()) throw new IncompleteRowError('Request body fields')
    if (row.children) assertKeysPresent(row.children)
  }
}

/**
 * One body field, in the shape Meta enforces.
 *
 * The rule that makes this non-obvious: **a nested node must be a JSON-encoded
 * string, not an inline object**, and it applies at every level. An inline
 * object is rejected with
 *
 *   request_definition.body.params.lines.items.properties.sku must be a JSON
 *   object string that describes a body field.
 *
 * Verified against the live API on 2026-09-04 across 39 shapes — see
 * docs/meta-api/connector-tools-capability-matrix.md. An earlier conclusion in
 * this project that "Meta rejects nested bodies" was wrong: it rejected the
 * encoding, not the capability, and that mistake is why the editor was
 * flat-only until now.
 *
 * `required` is deliberately absent from every node. For a body it belongs in
 * `body.required` as a top-level string[], which is why only top-level fields
 * can be marked required — Meta gives no verified place to say it deeper.
 */
function buildBodyNode(row: BodyFieldRow): Record<string, unknown> {
  const description = row.description.trim()

  if (row.type === 'object') {
    const properties: Record<string, string> = {}
    for (const child of row.children ?? []) {
      properties[child.key.trim()] = JSON.stringify(buildBodyNode(child))
    }
    return {
      type: 'object',
      ...(description ? { description } : {}),
      properties,
    }
  }

  if (row.type === 'array') {
    const itemType = row.itemType ?? 'string'
    const itemNode: Record<string, unknown> =
      itemType === 'object'
        ? {
            type: 'object',
            properties: Object.fromEntries(
              (row.children ?? []).map((child) => [
                child.key.trim(),
                JSON.stringify(buildBodyNode(child)),
              ]),
            ),
          }
        : { type: itemType }
    return {
      type: 'array',
      ...(description ? { description } : {}),
      // Also a JSON-encoded string, for the same reason as properties above.
      items: JSON.stringify(itemNode),
    }
  }

  const binding = bindingFor(row.fill, row.fixedValue)
  return {
    type: row.type,
    ...(description ? { description } : {}),
    ...(binding ? { binding } : {}),
  }
}

export function buildRequestDefinition(form: ToolFormState): RequestDefinition {
  const def: RequestDefinition = { method: form.method, path: form.path }

  const pathParameters = rowsToRecord(form.pathParams, 'Path parameters')
  if (pathParameters) def.path_parameters = pathParameters

  const queryParameters = rowsToRecord(form.queryParams, 'Query parameters')
  if (queryParameters) def.query_parameters = queryParameters

  const headers = rowsToRecord(form.headerParams, 'Headers')
  if (headers) def.headers = headers

  if (form.bodyFields.length > 0 && methodSendsBody(form.method)) {
    assertKeysPresent(form.bodyFields)
    const params: Record<string, unknown> = {}
    const required: string[] = []
    for (const field of form.bodyFields) {
      const key = field.key.trim()
      params[key] = buildBodyNode(field)
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

/**
 * The inverse of buildBodyNode. A nested node arrives as a JSON string, so this
 * decodes at each level — a string that fails to parse is treated as a plain
 * field rather than throwing, because refusing to open an existing tool would be
 * worse than showing it imperfectly.
 */
function nodeToBodyRow(key: string, raw: unknown, required: boolean): BodyFieldRow {
  const node = (typeof raw === 'string' ? safeParse(raw) : raw) as {
    type?: BodyFieldType
    description?: string
    properties?: Record<string, unknown>
    items?: unknown
    binding?: { kind: string; value?: string; macro?: string }
  } | null

  const base = {
    key,
    description: node?.description ?? '',
    required,
    ...fillFromBinding(node?.binding),
  }

  if (node?.type === 'object') {
    return {
      ...base,
      type: 'object',
      children: Object.entries(node.properties ?? {}).map(([k, v]) => nodeToBodyRow(k, v, false)),
    }
  }

  if (node?.type === 'array') {
    const item = (typeof node.items === 'string' ? safeParse(node.items) : node.items) as {
      type?: BodyFieldType
      properties?: Record<string, unknown>
    } | null
    const itemType: BodyFieldType = item?.type ?? 'string'
    return {
      ...base,
      type: 'array',
      itemType,
      children:
        itemType === 'object'
          ? Object.entries(item?.properties ?? {}).map(([k, v]) => nodeToBodyRow(k, v, false))
          : undefined,
    }
  }

  return { ...base, type: node?.type ?? 'string' }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function parseRequestDefinition(def: RequestDefinition): ToolFormState {
  const requiredSet = new Set(def.body?.required ?? [])
  const bodyFields: BodyFieldRow[] = def.body
    ? Object.entries(def.body.params).map(([key, raw]) => nodeToBodyRow(key, raw, requiredSet.has(key)))
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
  return rowsFromExample(parsed as Record<string, unknown>, existingRows)
}

/**
 * Turns a pasted example body into rows, at any depth.
 *
 * This used to refuse anything nested — "flat fields only, contact
 * engineering" — which was a self-imposed limit, not a platform one. Meta
 * accepts nested bodies; we were encoding them wrongly and drew the wrong
 * conclusion from our own opaque 400. Pasting a real enterprise payload is now
 * the fastest way to build one of these, which is the whole point.
 *
 * Existing rows are matched by key so a description or a fixed value typed in
 * earlier is not wiped when the example JSON is tweaked.
 */
function rowsFromExample(obj: Record<string, unknown>, existingRows: BodyFieldRow[]): BodyFieldRow[] {
  const existingByKey = new Map(existingRows.map((r) => [r.key, r]))
  return Object.entries(obj).map(([key, value]) => {
    const existing = existingByKey.get(key)
    const base = {
      key,
      description: existing?.description ?? '',
      required: existing?.required ?? false,
      // Carried over for the same reason as description/required: retyping the example JSON
      // must not silently revert a field from "Fixed value" back to agent-filled.
      fill: existing?.fill ?? ('agent' as FillMode),
      fixedValue: existing?.fixedValue ?? '',
    }

    if (Array.isArray(value)) {
      const first = value[0]
      const isObjectList = typeof first === 'object' && first !== null && !Array.isArray(first)
      return {
        ...base,
        type: 'array' as const,
        itemType: isObjectList ? ('object' as const) : inferParamType(first),
        children: isObjectList
          ? rowsFromExample(first as Record<string, unknown>, existing?.children ?? [])
          : undefined,
      }
    }

    if (typeof value === 'object' && value !== null) {
      return {
        ...base,
        type: 'object' as const,
        children: rowsFromExample(value as Record<string, unknown>, existing?.children ?? []),
      }
    }

    return { ...base, type: inferParamType(value) }
  })
}

/** A non-empty example value per field, not a blank/zero placeholder — the operator should see
 * something submittable, not "{}" or {"query": ""} with no hint of what belongs there.
 * A fixed field shows its actual value, coerced to the field's type, because that is literally
 * what gets sent — a generic placeholder there would misrepresent the request. */
function exampleValueFor(row: BodyFieldRow): unknown {
  if (row.type === 'object') {
    return Object.fromEntries((row.children ?? []).map((c) => [c.key, exampleValueFor(c)]))
  }
  if (row.type === 'array') {
    // One element, not two: the operator needs to see the item's shape, and a
    // repeated element adds nothing but height.
    const itemType = row.itemType ?? 'string'
    if (itemType === 'object') {
      return [Object.fromEntries((row.children ?? []).map((c) => [c.key, exampleValueFor(c)]))]
    }
    return [exampleValueFor({ ...row, type: itemType, children: undefined })]
  }
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
