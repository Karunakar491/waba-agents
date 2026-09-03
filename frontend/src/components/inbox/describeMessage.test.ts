import { describeMessage } from './describeMessage'

/**
 * The payloads below are copied verbatim from production
 * (GET /conversations/{id}/messages, 2026-09-03), not invented. Every one of
 * them rendered as the literal string "[interactive]" before this change.
 */
describe('describeMessage', () => {
  it('shows what the customer chose from a list, not "[interactive]"', () => {
    const json = JSON.stringify({
      id: 'wamid.HBgMOTE5MzQ4MTY4MTg2',
      from: '919348168186',
      type: 'interactive',
      interactive: {
        type: 'list_reply',
        list_reply: {
          id: 'biz_ai_list_supplier_29146122',
          title: 'Aroplast Enterprise',
          description: '₹60/Kg | Ahmedabad, Gujarat',
        },
      },
    })

    expect(describeMessage('interactive', null, json)).toEqual({
      text: 'Aroplast Enterprise',
      detail: '₹60/Kg | Ahmedabad, Gujarat',
      kind: 'Chose from a list',
    })
  })

  it('distinguishes a real call-permission answer from WhatsApp answering for them', () => {
    const automatic = JSON.stringify({
      type: 'interactive',
      interactive: {
        type: 'call_permission_reply',
        call_permission_reply: { response: 'reject', response_source: 'automatic' },
      },
    })
    const byUser = JSON.stringify({
      type: 'interactive',
      interactive: {
        type: 'call_permission_reply',
        call_permission_reply: { response: 'accept', is_permanent: true, response_source: 'user_action' },
      },
    })

    // "automatic" is WhatsApp declining, NOT the customer saying no — an
    // operator who reads it as a refusal would draw the wrong conclusion.
    expect(describeMessage('interactive', null, automatic)).toEqual({
      text: 'Did not allow calls',
      detail: 'Answered automatically by WhatsApp, not by the customer',
      kind: 'Call permission',
    })
    expect(describeMessage('interactive', null, byUser)).toEqual({
      text: 'Allowed calls from this business',
      detail: undefined,
      kind: 'Call permission',
    })
  })

  it('names a button tap', () => {
    const json = JSON.stringify({
      interactive: { type: 'button_reply', button_reply: { id: 'b1', title: 'Track my order' } },
    })
    expect(describeMessage('interactive', null, json)).toMatchObject({
      text: 'Track my order',
      kind: 'Tapped a button',
    })
  })

  it('prefers plain text whenever it exists', () => {
    expect(describeMessage('text', 'I wanna track my shipment', '{"ignored":true}')).toEqual({
      text: 'I wanna track my shipment',
    })
  })

  it('shows a document by its filename', () => {
    const json = JSON.stringify({ document: { filename: 'invoice-8891.pdf', caption: 'My invoice' } })
    expect(describeMessage('document', null, json)).toEqual({
      text: 'invoice-8891.pdf',
      detail: 'My invoice',
      kind: 'Document',
    })
  })

  it('shows a shared location', () => {
    const json = JSON.stringify({ location: { name: 'Andheri Depot', address: 'Mumbai 400053' } })
    expect(describeMessage('location', null, json)).toEqual({
      text: 'Andheri Depot',
      detail: 'Mumbai 400053',
      kind: 'Location',
    })
  })

  it('unwraps a nested text body', () => {
    const json = JSON.stringify({ type: 'text', text: { body: 'Hello there' } })
    expect(describeMessage('text', null, json)).toEqual({ text: 'Hello there' })
  })

  it('names an unknown interactive kind rather than hiding it', () => {
    const json = JSON.stringify({ interactive: { type: 'flow_completion', flow_completion: {} } })
    expect(describeMessage('interactive', null, json)).toEqual({
      text: 'Sent a flow completion',
      kind: 'Interactive',
    })
  })

  it('never throws on junk, and still says something', () => {
    expect(describeMessage('interactive', null, 'not json at all')).toEqual({
      text: 'Sent a interactive',
      kind: 'Unrecognised',
    })
    expect(describeMessage('', null, null)).toEqual({ text: 'Sent a message', kind: 'Unrecognised' })
    expect(describeMessage('text', '   ', null)).toMatchObject({ kind: 'Unrecognised' })
  })
})
