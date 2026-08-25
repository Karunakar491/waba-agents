// jest's describe/it/expect are ambient globals (per jest.config.cjs) — no import needed, matching this project's jest convention.
import {
  buildRequestDefinition,
  parseRequestDefinition,
  extractPathParamNames,
  IncompleteRowError,
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
