/**
 * Turns a cURL command into an action.
 *
 * Operators do not describe an API in prose — they paste the cURL their
 * customer sent them. Every field on this screen is already in that string, so
 * asking someone to retype it into eight inputs is asking them to transcribe.
 *
 * The important half is what it REFUSES to do quietly. Meta accepts a narrow
 * shape — JSON bodies only, no cookies, no form posts, one credential and only
 * on the connector — so a cURL is regularly something we cannot represent. The
 * failure that matters is the silent one: importing a `--data-urlencode` form
 * post as if it were JSON produces an action that looks right and never works.
 * So this returns `problems` alongside the fields, and the screen shows them
 * before anything is applied.
 */

export interface ParsedCurl {
  method: string
  /** Scheme and host, e.g. `https://api.example.com`. Compared against the connector's. */
  origin: string
  /** Everything after the host, without the query string. */
  path: string
  queryParams: { key: string; value: string }[]
  /** Header rows, credential headers excluded — those are listed in `credentialHeaders`. */
  headers: { key: string; value: string }[]
  /**
   * Headers that carry a credential. Separated because in Meta these belong to
   * the connector, not the action, and because their VALUES must not be stored.
   */
  credentialHeaders: { key: string; value: string }[]
  body: string | null
  /** What cannot be represented, in words an operator can act on. */
  problems: string[]
}

/** Header names that are a credential rather than a description of the request. */
const CREDENTIAL_HEADERS = [
  'authorization',
  'x-api-key',
  'x-auth-token',
  'apikey',
  'api-key',
  'x-access-token',
  'token',
]

/**
 * Splits a shell command into tokens.
 *
 * Handles the three things that actually appear in a pasted cURL: single
 * quotes, double quotes, and a backslash-newline continuation. Not a shell
 * parser — it does not do variable expansion or subshells, and a cURL
 * containing those is reported as a problem rather than half-understood.
 */
function tokenize(input: string): string[] {
  // Line continuations first, so a multi-line paste becomes one command.
  const text = input.replace(/\\\r?\n/g, ' ').trim()
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let started = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (quote) {
      if (char === quote) {
        quote = null
      } else if (char === '\\' && quote === '"' && i + 1 < text.length) {
        // Inside double quotes a backslash escapes the next character.
        current += text[++i]
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      started = true
      continue
    }

    if (/\s/.test(char)) {
      if (current || started) tokens.push(current)
      current = ''
      started = false
      continue
    }

    current += char
  }
  if (current || started) tokens.push(current)
  return tokens
}

/** Flags that take a value we do not use but must not mistake for the URL. */
const VALUED_FLAGS_IGNORED = [
  '--connect-timeout', '--max-time', '-m', '--retry', '-o', '--output',
  '-w', '--write-out', '-A', '--user-agent', '-e', '--referer', '--resolve',
  '--proxy', '-x', '--limit-rate', '--cacert', '--cert-type', '--key-type',
]

export function parseCurl(input: string): ParsedCurl | null {
  const tokens = tokenize(input)
  if (tokens.length === 0) return null
  if (!tokens.some((t) => t === 'curl' || t.endsWith('/curl'))) return null

  const problems: string[] = []
  const headers: { key: string; value: string }[] = []
  const credentialHeaders: { key: string; value: string }[] = []
  const dataParts: string[] = []
  let url = ''
  let explicitMethod: string | null = null
  let sawForm = false
  let sawUrlEncode = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === 'curl' || token.endsWith('/curl')) continue

    if (token === '-X' || token === '--request') {
      explicitMethod = (tokens[++i] ?? '').toUpperCase()
      continue
    }

    if (token === '-H' || token === '--header') {
      const raw = tokens[++i] ?? ''
      const at = raw.indexOf(':')
      if (at < 0) {
        problems.push(`Could not read the header "${raw}" — no colon in it.`)
        continue
      }
      const key = raw.slice(0, at).trim()
      const value = raw.slice(at + 1).trim()
      if (key.toLowerCase() === 'cookie') {
        problems.push(
          'A Cookie header was dropped. Meta sends no cookies, so an API that ' +
            'needs a session cannot be called by an agent — it needs a token instead.',
        )
        continue
      }
      if (CREDENTIAL_HEADERS.includes(key.toLowerCase())) {
        credentialHeaders.push({ key, value })
      } else {
        headers.push({ key, value })
      }
      continue
    }

    if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      dataParts.push(tokens[++i] ?? '')
      continue
    }

    if (token === '--data-urlencode') {
      sawUrlEncode = true
      dataParts.push(tokens[++i] ?? '')
      continue
    }

    if (token === '-F' || token === '--form') {
      sawForm = true
      i++
      continue
    }

    if (token === '-u' || token === '--user') {
      const value = tokens[++i] ?? ''
      credentialHeaders.push({ key: 'Authorization', value: `Basic ${value}` })
      problems.push(
        'Basic auth was turned into an Authorization header. Meta has no basic-auth ' +
          'mode, so this only works if the API accepts the header directly.',
      )
      continue
    }

    if (token === '-b' || token === '--cookie') {
      i++
      problems.push('A cookie was dropped — Meta sends none.')
      continue
    }

    if (token === '--location' || token === '-L') {
      problems.push(
        'This cURL follows redirects. We do not: a redirect is not followed when ' +
          'the agent calls this, so give the final URL if the first one redirects.',
      )
      continue
    }

    if (token === '-k' || token === '--insecure') {
      problems.push(
        'This cURL skips certificate checks. We do not, so an API with a bad ' +
          'certificate will fail here even though it worked in your terminal.',
      )
      continue
    }

    if (VALUED_FLAGS_IGNORED.includes(token)) {
      i++
      continue
    }

    // A bare flag we do not model. Ignored rather than guessed at.
    if (token.startsWith('-')) continue

    if (!url) url = token
  }

  if (!url) {
    problems.push('No URL found in that command.')
    return {
      method: explicitMethod ?? 'GET',
      origin: '',
      path: '',
      queryParams: [],
      headers,
      credentialHeaders,
      body: null,
      problems,
    }
  }

  if (/\$\{?[A-Za-z_]/.test(url)) {
    problems.push(
      'That URL contains a shell variable, which we cannot resolve. Replace it ' +
        'with the real value.',
    )
  }

  let origin = ''
  let path = ''
  const queryParams: { key: string; value: string }[] = []
  try {
    const parsed = new URL(url)
    origin = parsed.origin
    path = parsed.pathname
    parsed.searchParams.forEach((value, key) => queryParams.push({ key, value }))
  } catch {
    problems.push(`Could not read "${url}" as a URL.`)
  }

  if (sawForm) {
    problems.push(
      'This is a multipart form post. Meta only sends application/json, so this ' +
        'request cannot be represented as it stands.',
    )
  }
  if (sawUrlEncode) {
    problems.push(
      'This is a url-encoded form post. Meta only sends application/json, so the ' +
        'API has to accept JSON for an agent to call it.',
    )
  }

  const body = dataParts.length > 0 ? dataParts.join('&') : null

  if (body && !sawForm && !sawUrlEncode) {
    const trimmed = body.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      problems.push(
        'The body is not JSON. Meta sends application/json only — an agent cannot ' +
          'send this body as it is.',
      )
    } else {
      try {
        JSON.parse(trimmed)
      } catch {
        problems.push('The body looks like JSON but does not parse. Check it before saving.')
      }
    }
  }

  const contentType = headers.find((h) => h.key.toLowerCase() === 'content-type')
  if (contentType && !/json/i.test(contentType.value)) {
    problems.push(
      `Content-Type is "${contentType.value}". Meta always sends application/json ` +
        'and will not send this one.',
    )
  }

  // A method is inferred the way curl does it, so an imported request behaves
  // like the one that was pasted.
  const method = explicitMethod ?? (body || sawForm ? 'POST' : 'GET')

  return { method, origin, path, queryParams, headers, credentialHeaders, body, problems }
}
