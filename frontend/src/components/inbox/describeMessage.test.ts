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

  /*
   * What the business SENT, not what the customer tapped. Until 2026-09-18 the
   * outbound side was discarded before it ever reached this file, so a customer
   * shown five prices appeared in the Inbox as a blank bubble.
   *
   * This payload is real — copied from the stored webhook for WhatsApp
   * +91 85916 89475 (docs/e2e-test-runs/2026-09-17-astrotalk-webhooks.md).
   */
  it('shows every option in a list the agent sent, not just that it sent one', () => {
    const json = JSON.stringify({
      interactive: {
        type: 'list',
        body: { text: 'Select your session duration for Astro Sneha:' },
        action: {
          button: 'View Options',
          sections: [
            {
              rows: [
                { id: 'biz_ai_list_duration_5', title: '5 minutes', description: '₹225' },
                { id: 'biz_ai_list_duration_10', title: '10 minutes', description: '₹450' },
                { id: 'biz_ai_list_duration_30', title: '30 minutes', description: '₹1350' },
              ],
            },
          ],
        },
      },
    })

    expect(describeMessage('interactive', null, json)).toEqual({
      text: 'Sent a list: View Options',
      // Every row, with its price. Someone handling "I was charged the wrong
      // amount" needs the whole set that was on screen, not a preview.
      detail: '5 minutes (₹225) · 10 minutes (₹450) · 30 minutes (₹1350)',
      kind: 'Interactive list',
    })
  })

  it('shows the label on a link button, since that is what the customer tapped', () => {
    const json = JSON.stringify({
      interactive: {
        type: 'cta_url',
        body: { text: 'Ready to book Ritambari Ji for 10 minutes?' },
        action: { parameters: { display_text: 'Pay ₹100', url: 'https://rzp.io/rzp/KYRO0aqw' } },
      },
    })

    expect(describeMessage('interactive', null, json)).toEqual({
      text: 'Ready to book Ritambari Ji for 10 minutes?',
      detail: 'Button: Pay ₹100',
      kind: 'Link button',
    })
  })

  it('names the buttons the agent offered', () => {
    const json = JSON.stringify({
      interactive: {
        type: 'button',
        body: { text: 'Shall I connect you now?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'yes', title: 'Haan, abhi' } },
            { type: 'reply', reply: { id: 'later', title: 'Baad mein' } },
          ],
        },
      },
    })

    expect(describeMessage('interactive', null, json)).toEqual({
      text: 'Shall I connect you now?',
      detail: 'Haan, abhi · Baad mein',
      kind: 'Buttons',
    })
  })

  it('falls back to the body when a list somehow carries no rows', () => {
    const json = JSON.stringify({
      interactive: {
        type: 'list',
        body: { text: 'Pick a duration' },
        action: { button: 'View Options', sections: [] },
      },
    })

    expect(describeMessage('interactive', null, json)).toEqual({
      text: 'Sent a list: View Options',
      detail: 'Pick a duration',
      kind: 'Interactive list',
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
