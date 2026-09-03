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
} from './toolRequestDefinition'
import type { ToolFormState } from './toolRequestDefinition'

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
        { key: 'query', type: 'string', description: 'search text', required: true },
        { key: 'limit', type: 'integer', description: '', required: false },
      ],
    }
    const result = buildRequestDefinition(form)
    expect(result.body?.required).toEqual(['query'])
    expect(result.body?.params.query).not.toHaveProperty('required')
    expect(result.body?.params.limit).not.toHaveProperty('required')
  })

  it('never emits body for GET or DELETE even if bodyFields is populated', () => {
    const form: ToolFormState = {
      method: 'GET',
      path: '/',
      pathParams: [],
      queryParams: [],
      headerParams: [],
      bodyFields: [{ key: 'query', type: 'string', description: '', required: true }],
    }
    expect(buildRequestDefinition(form).body).toBeUndefined()
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
    expect(() => buildRequestDefinition({ ...baseForm, bodyFields: [{ key: '', type: 'string', description: '', required: false }] })).toThrow(IncompleteRowError)
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
      bodyFields: [{ key: 'note', type: 'string', description: 'Optional note', required: false }],
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
      { key: 'query', type: 'string', description: '', required: false },
      { key: 'limit', type: 'integer', description: '', required: false },
      { key: 'score', type: 'number', description: '', required: false },
      { key: 'urgent', type: 'boolean', description: '', required: false },
    ])
  })

  it('preserves description and required from an existing row with the same key', () => {
    const existing = [{ key: 'query', type: 'string' as const, description: 'search text', required: true }]
    const rows = parseBodyJson('{"query": "anything"}', existing)
    expect(rows).toEqual([{ key: 'query', type: 'string', description: 'search text', required: true }])
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
      { key: 'query', type: 'string', description: '', required: true },
      { key: 'limit', type: 'integer', description: '', required: false },
      { key: 'score', type: 'number', description: '', required: false },
      { key: 'urgent', type: 'boolean', description: '', required: false },
    ])
    expect(JSON.parse(json)).toEqual({ query: 'TMT Bars', limit: 1, score: 1.5, urgent: true })
  })
})
