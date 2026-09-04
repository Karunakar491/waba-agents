import { describeToolRun } from './describeToolRun'

/**
 * Every envelope below was captured from a real run against production on
 * 2026-09-04 — the IndiaMART tool and the httpbin probes — not hand-written.
 */
describe('describeToolRun', () => {
  it('pulls an XML document out of the triple-wrapped envelope, unescaped', () => {
    const raw = JSON.stringify({
      status: { code: 1 },
      body: JSON.stringify({
        output: {
          status: 200,
          data: "<?xml version='1.0' encoding='us-ascii'?>\n<slideshow title=\"Sample Slide Show\">\n</slideshow>",
          headers: { 'content-type': 'application/xml', 'content-length': '522' },
        },
        actionRunId: '6a9a67d301c7102d2a91b34d',
      }),
    })

    const view = describeToolRun(raw)

    expect(view.ok).toBe(true)
    expect(view.httpStatus).toBe(200)
    // The whole point: a real "<", not a < escape.
    expect(view.body).toContain('<?xml version')
    expect(view.body).toContain('<slideshow')
    expect(view.body).not.toContain('\\u003C')
    expect(view.headers?.['content-type']).toBe('application/xml')
    expect(view.error).toBeNull()
  })

  it('pretty-prints a JSON response instead of leaving it on one line', () => {
    const raw = JSON.stringify({
      status: { code: 1 },
      body: JSON.stringify({
        output: { status: 200, data: { success: true, data: [{ companyName: 'Indian Clay Craft', city: 'New Delhi' }] } },
      }),
    })

    const view = describeToolRun(raw)

    expect(view.body).toContain('\n')
    expect(view.body).toContain('"companyName": "Indian Clay Craft"')
    expect(view.ok).toBe(true)
  })

  it('reports the real reason when the tool itself was rejected', () => {
    // What the live IndiaMART tool returned while `query` was undeclared.
    const raw = JSON.stringify({
      status: { code: 2, message: 'Invalid request', failure_code: 20 },
      body: JSON.stringify({ success: false, message: 'Query is required' }),
    })

    const view = describeToolRun(raw)

    expect(view.ok).toBe(false)
    expect(view.error).toContain('Invalid request')
    // The API's own explanation must still be visible, not swallowed.
    expect(view.body).toContain('Query is required')
  })

  it('flags an HTTP error from the partner API even when Meta reports success', () => {
    const raw = JSON.stringify({
      status: { code: 1 },
      body: JSON.stringify({ output: { status: 404, data: 'Not Found' } }),
    })

    const view = describeToolRun(raw)

    // Meta ran the tool fine; the API said no. Those are different failures.
    expect(view.ok).toBe(true)
    expect(view.httpStatus).toBe(404)
    expect(view.error).toContain('HTTP 404')
  })

  it('keeps the raw envelope available whatever happens', () => {
    const raw = JSON.stringify({ status: { code: 1 }, body: '{}' })
    expect(describeToolRun(raw).raw).toBe(raw)
  })

  it('degrades to showing the text rather than blanking on junk', () => {
    expect(describeToolRun('not json at all').body).toBe('not json at all')
    expect(describeToolRun('').error).toContain('nothing at all')
    expect(describeToolRun(undefined).error).toContain('nothing at all')
    expect(describeToolRun('[1,2,3]').body).toBe('[1,2,3]')
  })

  it('handles an envelope with no inner body wrapper', () => {
    const raw = JSON.stringify({ status: { code: 1 }, output: { status: 200, data: 'plain text' } })
    const view = describeToolRun(raw)
    expect(view.body).toBe('plain text')
    expect(view.httpStatus).toBe(200)
  })
})
