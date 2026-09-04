// jest's describe/it/expect are ambient globals (per jest.config.cjs) — no import needed, matching this project's jest convention.
import {
  buildRequestDefinition,
  parseRequestDefinition,
  extractPathParamNames,
  IncompleteRowError,
  buildPreviewUrl,
  parseBodyJson,
  InvalidBodyJsonError,
  bodyRowsToJson,
  methodSendsBody,
} from './toolRequestDefinition'
import type { ToolFormState, BodyFieldRow } from './toolRequestDefinition'

describe('buildRequestDefinition', () => {
  it('omits query_parameters, headers, and body entirely when their row lists are empty', () => {
    const form: ToolFormState = {
      method: 'GET',
      path: '/search',
      pathParams: [],
      queryParams: [],
      headerParams: [],
      bodyFields: [],
    }
    const result = buildRequestDefinition(form)
    expect(result).toEqual({ method: 'GET', path: '/search' })
    expect(result).not.toHaveProperty('query_parameters')
    expect(result).not.toHaveProperty('headers')
    expect(result).not.toHaveProperty('body')
  })

  it('serializes body field required-ness into body.required as a string array, never a per-field boolean', () => {
    const form: ToolFormState = {
      method: 'POST',
      path: '/',
      pathParams: [],
      queryParams: [],
      headerParams: [],
      bodyFields: [
        { key: 'query', type: 'string', description: 'search text', required: true, fill: 'agent' as const, fixedValue: '' },
        { key: 'limit', type: 'integer', description: '', required: false, fill: 'agent' as const, fixedValue: '' },
      ],
    }
    const result = buildRequestDefinition(form)
    expect(result.body?.required).toEqual(['query'])
    expect(result.body?.params.query).not.toHaveProperty('required')
    expect(result.body?.params.limit).not.toHaveProperty('required')
  })

  /**
   * The shape this control exists for. IndiaMART's product-search returns
   * 404 {"success":false,"message":"Missing action parameter"} unless `action` is sent
   * (verified against the live endpoint 2026-09-04), and it must be a constant, not
   * something the agent decides per conversation.
   */
  it('binds a fixed body field to kind default, and a macro body field to kind macro', () => {
    const form: ToolFormState = {
      method: 'POST',
      path: '/',
      pathParams: [],
      queryParams: [],
      headerParams: [],
      bodyFields: [
        { key: 'action', type: 'string', description: '', required: true, fill: 'fixed', fixedValue: 'product-search' },
        { key: 'query', type: 'string', description: '', required: true, fill: 'agent', fixedValue: '' },
        { key: 'from', type: 'string', description: '', required: false, fill: 'WHATSAPP_PHONE_NUMBER', fixedValue: '' },
      ],
    }
    const result = buildRequestDefinition(form)
    expect(result.body?.params.action).toMatchObject({ binding: { kind: 'default', value: 'product-search' } })
    expect(result.body?.params.from).toMatchObject({ binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' } })
    // An agent-filled field carries no binding at all — Meta's rule is omit, not null.
    expect(result.body?.params.query).not.toHaveProperty('binding')
    // Fixed-ness must not leak into required-ness, which still lives on body.required.
    expect(result.body?.required).toEqual(['action', 'query'])
    expect(result.body?.params.action).not.toHaveProperty('required')
  })

  it('round-trips a fixed body field through parseRequestDefinition without losing it', () => {
    const original: ToolFormState = {
      method: 'POST',
      path: '/',
      pathParams: [],
      queryParams: [],
      headerParams: [],
      bodyFields: [
        { key: 'action', type: 'string', description: 'Fixed selector', required: true, fill: 'fixed', fixedValue: 'product-search' },
        { key: 'city', type: 'string', description: 'Buyer city', required: false, fill: 'agent', fixedValue: '' },
      ],
    }
    const parsed = parseRequestDefinition(buildRequestDefinition(original))
    expect(parsed.bodyFields).toEqual(original.bodyFields)
  })

  /**
   * This used to be one test asserting "never emits body for GET or DELETE".
   * Half of it was wrong. Checked on the wire through Meta's runtime against
   * httpbin on 2026-09-04: a DELETE body IS delivered, a GET body is silently
   * dropped. So GET must keep refusing, and DELETE must stop.
   */
  const bodyField = { key: 'query', type: 'string' as const, description: '', required: true, fill: 'agent' as const, fixedValue: '' }
  const withBody = (method: string): ToolFormState => ({
    method, path: '/', pathParams: [], queryParams: [], headerParams: [], bodyFields: [bodyField],
  })

  it('never emits a body for GET, because Meta drops it', () => {
    expect(buildRequestDefinition(withBody('GET')).body).toBeUndefined()
  })

  it('emits a body for DELETE, because Meta delivers it', () => {
    const body = buildRequestDefinition(withBody('DELETE')).body
    expect(body?.params.query).toMatchObject({ type: 'string' })
    expect(body?.required).toEqual(['query'])
  })

  it('emits a body for POST, PUT and PATCH', () => {
    for (const method of ['POST', 'PUT', 'PATCH']) {
      // jest expect takes no message argument, unlike playwright/vitest
      expect({ method, body: buildRequestDefinition(withBody(method)).body === undefined }).toEqual({ method, body: false })
    }
  })

  it('methodSendsBody matches what the wire actually does', () => {
    expect(methodSendsBody('POST')).toBe(true)
    expect(methodSendsBody('PUT')).toBe(true)
    expect(methodSendsBody('PATCH')).toBe(true)
    expect(methodSendsBody('DELETE')).toBe(true)
    expect(methodSendsBody('GET')).toBe(false)
  })

  it('models a fixed-value binding as kind default, and a macro fill as kind macro', () => {
    const form: ToolFormState = {
      method: 'GET',
      path: '/',
      pathParams: [],
      queryParams: [
        { key: 'action', type: 'string', description: '', required: false, fill: 'fixed', fixedValue: 'product-search' },
        { key: 'phone', type: 'string', description: '', required: false, fill: 'WHATSAPP_PHONE_NUMBER', fixedValue: '' },
      ],
      headerParams: [],
      bodyFields: [],
    }
    const result = buildRequestDefinition(form)
    expect(result.query_parameters?.action).toMatchObject({ binding: { kind: 'default', value: 'product-search' } })
    expect(result.query_parameters?.phone).toMatchObject({ binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' } })
  })

  it('throws IncompleteRowError instead of silently dropping a row with a blank key, in any section', () => {
    const baseForm: ToolFormState = { method: 'POST', path: '/', pathParams: [], queryParams: [], headerParams: [], bodyFields: [] }
    const blankRow = { key: '', type: 'string' as const, description: '', required: false, fill: 'agent' as const, fixedValue: '' }

    expect(() => buildRequestDefinition({ ...baseForm, queryParams: [blankRow] })).toThrow(IncompleteRowError)
    expect(() => buildRequestDefinition({ ...baseForm, headerParams: [blankRow] })).toThrow(IncompleteRowError)
    expect(() => buildRequestDefinition({ ...baseForm, bodyFields: [{ key: '', type: 'string', description: '', required: false, fill: 'agent' as const, fixedValue: '' }] })).toThrow(IncompleteRowError)
    // a fully-filled row alongside one blank row still throws — partial success is not an option
    expect(() =>
      buildRequestDefinition({ ...baseForm, queryParams: [{ ...blankRow, key: 'ok' }, blankRow] }),
    ).toThrow(IncompleteRowError)
  })

  it('parseRequestDefinition is the inverse of buildRequestDefinition for a full example', () => {
    const original: ToolFormState = {
      method: 'POST',
      path: '/orders/{order_id}',
      pathParams: [{ key: 'order_id', type: 'string', description: 'Order ID', required: true, fill: 'agent', fixedValue: '' }],
      queryParams: [{ key: 'action', type: 'string', description: '', required: false, fill: 'fixed', fixedValue: 'lookup' }],
      headerParams: [],
      bodyFields: [{ key: 'note', type: 'string', description: 'Optional note', required: false, fill: 'agent' as const, fixedValue: '' }],
    }
    const def = buildRequestDefinition(original)
    const parsed = parseRequestDefinition(def)
    expect(parsed.pathParams).toEqual(original.pathParams)
    expect(parsed.queryParams).toEqual(original.queryParams)
    expect(parsed.bodyFields).toEqual(original.bodyFields)
  })

  it('extractPathParamNames dedupes a repeated placeholder (/orders/{id}/items/{id} must yield one row, not two)', () => {
    expect(extractPathParamNames('/orders/{id}/items/{id}')).toEqual(['id'])
    expect(extractPathParamNames('/a/{x}/{y}')).toEqual(['x', 'y'])
    expect(extractPathParamNames('/a')).toEqual([])
  })
})

describe('buildPreviewUrl', () => {
  it('shows a fixed query value literally, and an agent-filled one as a placeholder', () => {
    const preview = buildPreviewUrl('GET', '/search', [], [
      { key: 'action', type: 'string', description: '', required: false, fill: 'fixed', fixedValue: 'product-search' },
      { key: 'query', type: 'string', description: '', required: true, fill: 'agent', fixedValue: '' },
    ])
    expect(preview).toBe('GET /search?action=product-search&query=<agent fills in>')
  })

  it('substitutes a fixed path param into its {token} and shows a macro fill by name', () => {
    const preview = buildPreviewUrl('GET', '/orders/{order_id}', [
      { key: 'order_id', type: 'string', description: '', required: true, fill: 'WHATSAPP_PHONE_NUMBER', fixedValue: '' },
    ], [])
    expect(preview).toBe('GET /orders/<WHATSAPP_PHONE_NUMBER>')
  })

  it('omits the query string entirely when there are no query params', () => {
    expect(buildPreviewUrl('GET', '/ping', [], [])).toBe('GET /ping')
  })
})

describe('parseBodyJson', () => {
  it('infers string/integer/number/boolean from a flat example object', () => {
    const rows = parseBodyJson('{"query": "TMT Bars", "limit": 5, "score": 4.5, "urgent": true}', [])
    expect(rows).toEqual([
      { key: 'query', type: 'string', description: '', required: false, fill: 'agent' as const, fixedValue: '' },
      { key: 'limit', type: 'integer', description: '', required: false, fill: 'agent' as const, fixedValue: '' },
      { key: 'score', type: 'number', description: '', required: false, fill: 'agent' as const, fixedValue: '' },
      { key: 'urgent', type: 'boolean', description: '', required: false, fill: 'agent' as const, fixedValue: '' },
    ])
  })

  it('preserves description and required from an existing row with the same key', () => {
    const existing = [{ key: 'query', type: 'string' as const, description: 'search text', required: true, fill: 'agent' as const, fixedValue: '' }]
    const rows = parseBodyJson('{"query": "anything"}', existing)
    expect(rows).toEqual([{ key: 'query', type: 'string', description: 'search text', required: true, fill: 'agent' as const, fixedValue: '' }])
  })

  it('preserves a fixed fill and its value when the example JSON is retyped', () => {
    const existing = [
      { key: 'action', type: 'string' as const, description: '', required: true, fill: 'fixed' as const, fixedValue: 'product-search' },
    ]
    // The operator edits the JSON to add a field; `action` must not silently revert to
    // agent-filled, which would drop the constant the endpoint requires.
    const rows = parseBodyJson('{"action": "product-search", "city": "Delhi"}', existing)
    expect(rows[0]).toEqual({ key: 'action', type: 'string', description: '', required: true, fill: 'fixed', fixedValue: 'product-search' })
    expect(rows[1]).toEqual({ key: 'city', type: 'string', description: '', required: false, fill: 'agent', fixedValue: '' })
  })

  it('throws InvalidBodyJsonError on malformed JSON', () => {
    expect(() => parseBodyJson('{not json', [])).toThrow(InvalidBodyJsonError)
  })

  it('throws InvalidBodyJsonError on a nested object or array value', () => {
    expect(() => parseBodyJson('{"nested": {"a": 1}}', [])).toThrow(InvalidBodyJsonError)
    expect(() => parseBodyJson('{"list": [1, 2]}', [])).toThrow(InvalidBodyJsonError)
  })

  it('throws InvalidBodyJsonError when the top level is an array or a primitive', () => {
    expect(() => parseBodyJson('[1, 2]', [])).toThrow(InvalidBodyJsonError)
    expect(() => parseBodyJson('"just a string"', [])).toThrow(InvalidBodyJsonError)
  })
})

describe('bodyRowsToJson', () => {
  it('fills each field with a non-empty example value instead of a blank/zero placeholder', () => {
    const json = bodyRowsToJson([
      { key: 'query', type: 'string', description: '', required: true, fill: 'agent' as const, fixedValue: '' },
      { key: 'limit', type: 'integer', description: '', required: false, fill: 'agent' as const, fixedValue: '' },
      { key: 'score', type: 'number', description: '', required: false, fill: 'agent' as const, fixedValue: '' },
      { key: 'urgent', type: 'boolean', description: '', required: false, fill: 'agent' as const, fixedValue: '' },
    ])
    expect(JSON.parse(json)).toEqual({ query: 'TMT Bars', limit: 1, score: 1.5, urgent: true })
  })

  it('shows a fixed field its real value, coerced to the field type, not a generic placeholder', () => {
    const json = bodyRowsToJson([
      { key: 'action', type: 'string', description: '', required: true, fill: 'fixed', fixedValue: 'product-search' },
      { key: 'limit', type: 'integer', description: '', required: false, fill: 'fixed', fixedValue: '5' },
      { key: 'from', type: 'string', description: '', required: false, fill: 'WHATSAPP_PHONE_NUMBER', fixedValue: '' },
    ])
    expect(JSON.parse(json)).toEqual({ action: 'product-search', limit: 5, from: '<WHATSAPP_PHONE_NUMBER>' })
  })

  it('falls back to a type example rather than "<undefined>" when a row carries no fill', () => {
    // Regression: the macro branch was written as "not fixed and not agent", so a row
    // constructed without a fill rendered the literal string "<undefined>" as its example.
    const row = { key: 'query', type: 'string' as const, description: '', required: false } as BodyFieldRow
    expect(JSON.parse(bodyRowsToJson([row]))).toEqual({ query: 'TMT Bars' })
  })
})
