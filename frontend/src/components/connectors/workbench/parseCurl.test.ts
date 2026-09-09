import { parseCurl } from './parseCurl'

/**
 * The first case is the founder's own cURL, pasted verbatim from the IndiaMART
 * WhatsApp API — the exact string that prompted this feature. If the parser
 * ever stops handling it, this is the test that says so.
 *
 * The token has been replaced with a placeholder. The real one was live and is
 * being rotated; a credential does not belong in a repository, and a test that
 * carries one teaches everyone reading it that they may.
 */
const INDIAMART = `curl --location 'https://wahelp.indiamart.com/whatsapp/mba/index.php?action=product-search' \\
--header 'Authorization: Bearer TOKEN-PLACEHOLDER' \\
--header 'Content-Type: application/json' \\
--data '{
    "action": "product-search",
    "query": "biryani",
    "city": "Delhi"
}'`

describe('parseCurl', () => {
  it("reads the founder's IndiaMART command", () => {
    const parsed = parseCurl(INDIAMART)!

    expect(parsed.method).toBe('POST')
    expect(parsed.origin).toBe('https://wahelp.indiamart.com')
    expect(parsed.path).toBe('/whatsapp/mba/index.php')
    expect(parsed.queryParams).toEqual([{ key: 'action', value: 'product-search' }])
    expect(JSON.parse(parsed.body!)).toEqual({
      action: 'product-search',
      query: 'biryani',
      city: 'Delhi',
    })
  })

  it('puts the credential aside instead of among the headers', () => {
    const parsed = parseCurl(INDIAMART)!

    // Authorization is the connector's, not the action's — a tool cannot carry
    // a credential in Meta, so it must not land in the Headers table.
    expect(parsed.headers.map((h) => h.key)).toEqual(['Content-Type'])
    expect(parsed.credentialHeaders).toEqual([
      { key: 'Authorization', value: 'Bearer TOKEN-PLACEHOLDER' },
    ])
  })

  it('says that --location will not be honoured, because we follow no redirects', () => {
    const parsed = parseCurl(INDIAMART)!

    expect(parsed.problems.join(' ')).toMatch(/follows redirects/i)
  })

  it('infers POST from a body and GET without one, the way curl does', () => {
    expect(parseCurl(`curl https://api.example.com/orders`)!.method).toBe('GET')
    expect(parseCurl(`curl https://api.example.com/orders -d '{"a":1}'`)!.method).toBe('POST')
    // An explicit -X wins, even against a body.
    expect(parseCurl(`curl -X PUT https://api.example.com/x -d '{"a":1}'`)!.method).toBe('PUT')
  })

  it('refuses to pretend a form post is JSON', () => {
    const form = parseCurl(`curl -X POST https://api.example.com/x -F 'file=@a.pdf'`)!
    expect(form.problems.join(' ')).toMatch(/multipart form post/i)

    const encoded = parseCurl(`curl https://api.example.com/x --data-urlencode 'q=biryani'`)!
    expect(encoded.problems.join(' ')).toMatch(/url-encoded form post/i)
  })

  it('drops cookies and says an agent cannot hold a session', () => {
    const parsed = parseCurl(`curl https://api.example.com/x -H 'Cookie: SESSION=abc'`)!

    expect(parsed.headers).toEqual([])
    expect(parsed.problems.join(' ')).toMatch(/needs a session cannot be called/i)
  })

  it('flags a non-JSON Content-Type rather than importing a request that cannot be sent', () => {
    const parsed = parseCurl(
      `curl https://api.example.com/x -H 'Content-Type: application/xml' -d '<a/>'`,
    )!

    expect(parsed.problems.join(' ')).toMatch(/application\/xml/)
    expect(parsed.problems.join(' ')).toMatch(/always sends application\/json/)
  })

  it('flags -k, because a certificate that fails here worked in their terminal', () => {
    const parsed = parseCurl(`curl -k https://api.example.com/x`)!

    expect(parsed.problems.join(' ')).toMatch(/certificate/i)
  })

  it('turns -u into an Authorization header and says what that assumes', () => {
    const parsed = parseCurl(`curl -u alice:secret https://api.example.com/x`)!

    expect(parsed.credentialHeaders).toEqual([
      { key: 'Authorization', value: 'Basic alice:secret' },
    ])
    expect(parsed.problems.join(' ')).toMatch(/no basic-auth mode/i)
  })

  it('says so when a URL is a shell variable rather than importing a broken one', () => {
    const parsed = parseCurl(`curl "$BASE_URL/orders"`)!

    expect(parsed.problems.join(' ')).toMatch(/shell variable/i)
  })

  it('keeps every query parameter, in order', () => {
    const parsed = parseCurl(`curl 'https://api.example.com/s?a=1&b=two&c=three'`)!

    expect(parsed.queryParams).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: 'two' },
      { key: 'c', value: 'three' },
    ])
  })

  it('handles a body containing spaces, braces and escaped quotes', () => {
    const parsed = parseCurl(
      `curl https://api.example.com/x -d "{\\"note\\": \\"leave at gate\\"}"`,
    )!

    expect(JSON.parse(parsed.body!)).toEqual({ note: 'leave at gate' })
  })

  it('reports a body that claims to be JSON and is not', () => {
    const parsed = parseCurl(`curl https://api.example.com/x -d '{"a": }'`)!

    expect(parsed.problems.join(' ')).toMatch(/does not parse/i)
  })

  it('returns null for something that is not a cURL command at all', () => {
    expect(parseCurl('')).toBeNull()
    expect(parseCurl('https://api.example.com/orders')).toBeNull()
    expect(parseCurl('wget https://api.example.com/orders')).toBeNull()
  })

  it('is not fooled by a flag value that looks like a URL', () => {
    const parsed = parseCurl(
      `curl -e https://referrer.example.com https://api.example.com/real`,
    )!

    expect(parsed.origin).toBe('https://api.example.com')
    expect(parsed.path).toBe('/real')
  })
})
