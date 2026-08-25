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

function buildParamNode(row: ParamRow): Record<string, unknown> {
  const node: Record<string, unknown> = { type: row.type }
  if (row.description.trim()) node.description = row.description.trim()
  if (row.required) node.required = true
  if (row.fill === 'fixed') {
    node.binding = { kind: 'default', value: row.fixedValue.trim() }
  } else if (row.fill !== 'agent') {
    node.binding = { kind: 'macro', macro: row.fill }
  }
  return node
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
      params[key] = {
        type: field.type,
        ...(field.description.trim() ? { description: field.description.trim() } : {}),
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
    let fill: FillMode = 'agent'
    let fixedValue = ''
    if (node.binding?.kind === 'default') {
      fill = 'fixed'
      fixedValue = node.binding.value ?? ''
    } else if (node.binding?.kind === 'macro' && node.binding.macro) {
      fill = node.binding.macro as FillMode
    }
    return {
      key,
      type: node.type ?? 'string',
      description: node.description ?? '',
      required: node.required ?? false,
      fill,
      fixedValue,
    }
  })
}

export function parseRequestDefinition(def: RequestDefinition): ToolFormState {
  const requiredSet = new Set(def.body?.required ?? [])
  const bodyFields: BodyFieldRow[] = def.body
    ? Object.entries(def.body.params).map(([key, raw]) => {
        const node = raw as { type?: ParamType; description?: string }
        return { key, type: node.type ?? 'string', description: node.description ?? '', required: requiredSet.has(key) }
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

export function extractPathParamNames(path: string): string[] {
  const matches = path.matchAll(/\{([^}]+)\}/g)
  // Deduped: a duplicate placeholder like /orders/{id}/items/{id} must yield one row, not
  // two — two rows sharing a locked key would silently collapse to last-write-wins in
  // setPathParamRows' merge, discarding an edit to the first one.
  return Array.from(new Set(Array.from(matches, (m) => m[1])))
}
