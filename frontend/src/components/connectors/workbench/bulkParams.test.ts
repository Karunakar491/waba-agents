import { paramsToText, textToParams } from './bulkParams'
import type { ParamRow } from '../../agent-detail/toolRequestDefinition'

const row = (over: Partial<ParamRow> = {}): ParamRow => ({
  key: 'product',
  type: 'string',
  description: '',
  required: false,
  fill: 'agent',
  fixedValue: '',
  ...over,
})

/**
 * The canvas promises "switching back to Table loses nothing", so that is what
 * these tests hold to: a round trip through text has to come back with the same
 * rows for anything the table can express.
 */
describe('bulk parameter text', () => {
  it('writes one line per parameter, in the artboard’s syntax', () => {
    const text = paramsToText([
      row({ key: 'product', description: 'What the buyer is looking for' }),
      row({ key: 'limit', fill: 'fixed', fixedValue: '10', description: 'Suppliers per reply' }),
      row({ key: 'phone', fill: 'fixed', fixedValue: '{{WHATSAPP_PHONE_NUMBER}}' }),
    ])

    expect(text).toBe(
      [
        'product: agent  // What the buyer is looking for',
        'limit: 10  // Suppliers per reply',
        'phone: {{WHATSAPP_PHONE_NUMBER}}',
      ].join('\n'),
    )
  })

  it('round-trips agent, fixed and macro sources', () => {
    const rows = [
      row({ key: 'product', description: 'what they want' }),
      row({ key: 'limit', fill: 'fixed', fixedValue: '10', type: 'integer' }),
      row({ key: 'phone', fill: 'fixed', fixedValue: '{{WHATSAPP_PHONE_NUMBER}}' }),
    ]

    const back = textToParams(paramsToText(rows), rows)

    expect(back).toEqual(rows)
  })

  it('keeps what the syntax cannot say — the type someone set in the table', () => {
    const rows = [row({ key: 'min_rating', type: 'number', fill: 'fixed', fixedValue: '3' })]

    const back = textToParams('min_rating: 3', rows)

    // 3 would infer as an integer; the row said number, and the row wins.
    expect(back[0].type).toBe('number')
  })

  it('keeps required, which the syntax also cannot say', () => {
    const rows = [row({ key: 'product', required: true })]

    expect(textToParams('product: agent', rows)[0].required).toBe(true)
  })

  it('infers an obvious type for a key the table did not have', () => {
    const parsed = textToParams(
      ['count: 10', 'ratio: 1.5', 'verified: true', 'city: Delhi', 'anyone: agent'].join('\n'),
      [],
    )

    expect(parsed.map((p) => `${p.key}:${p.type}`)).toEqual([
      'count:integer',
      'ratio:number',
      'verified:boolean',
      'city:string',
      'anyone:string',
    ])
  })

  it('treats a bare key as agent-filled rather than dropping the line', () => {
    const parsed = textToParams('product', [])

    expect(parsed).toEqual([row({ key: 'product' })])
  })

  it('reads everything after // as the description, including colons', () => {
    const parsed = textToParams('sort: price_asc  // one of: price_asc, price_desc', [])

    expect(parsed[0].fixedValue).toBe('price_asc')
    expect(parsed[0].description).toBe('one of: price_asc, price_desc')
  })

  it('drops a key removed from the text, and adds one typed into it', () => {
    const rows = [row({ key: 'product' }), row({ key: 'city' })]

    const parsed = textToParams('product: agent\npage: 2', rows)

    expect(parsed.map((p) => p.key)).toEqual(['product', 'page'])
  })

  it('ignores blank lines and leading space', () => {
    const parsed = textToParams('\n  product: agent\n\n   city: Delhi  \n', [])

    expect(parsed.map((p) => p.key)).toEqual(['product', 'city'])
  })

  it('leaves out a row with no key, so an empty table makes empty text', () => {
    expect(paramsToText([row({ key: '' })])).toBe('')
    expect(textToParams('', [])).toEqual([])
  })
})
