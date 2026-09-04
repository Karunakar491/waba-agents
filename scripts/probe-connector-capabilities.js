/**
 * Capability probe for Meta's Connector Tools API.
 *
 * Creates one throwaway tool per shape, records what Meta says, then DELETES it
 * immediately — so nothing is left on the live connector. Re-authenticates on 401
 * (the access token is 15 minutes and this run is longer than that).
 *
 * Read-only with respect to the real tool: never touches product_search.
 */
const fs = require('fs')

const BASE = 'https://app.karix.online/api/v1'
const AGENT = '875651765431701504'
const CONNECTOR = fs.readFileSync(process.argv[2] + '/cid.txt', 'utf8').trim()
const OUT = process.argv[2] + '/matrix-results.json'

const creds = {}
for (const line of fs.readFileSync(process.argv[3], 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
  if (m) creds[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

let cookie = ''

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.APP_USER, password: creds.APP_PASSWORD }),
  })
  const set = r.headers.getSetCookie ? r.headers.getSetCookie() : []
  cookie = set.map((c) => c.split(';')[0]).join('; ')
  if (!cookie) throw new Error('login produced no cookie: ' + r.status)
}

async function call(method, path, body, retry = true) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (r.status === 401 && retry) {
    await login()
    return call(method, path, body, false)
  }
  let json = null
  try { json = await r.json() } catch { /* empty body */ }
  return { status: r.status, json }
}

/** Meta's own words for the most recent failure of this tool name. */
async function metaReason(toolName) {
  const { json } = await call('GET', `/reports/api-calls?limit=80&pathContains=tools`)
  const rows = (json && json.data) || []
  const hit = rows.find((x) => x.statusCode >= 400 && (x.requestBody || '').includes(`"${toolName}"`))
  if (!hit) return ''
  let b = hit.responseBody
  try { b = JSON.parse(b) } catch { /* leave as-is */ }
  const o = typeof b === 'string' ? (() => { try { return JSON.parse(b) } catch { return { detail: b } } })() : b
  return (o && (o.detail || o.title)) || ''
}

const results = []

async function probe(group, label, requestDefinition) {
  const name = `zz_m_${Math.abs(hash(group + label))}`
  const { status, json } = await call('POST', `/agents/${AGENT}/connectors/${CONNECTOR}/tools`, {
    name,
    description: 'Temporary capability probe. Safe to delete.',
    user_auth_required: false,
    request_definition: requestDefinition,
  })
  const ok = status === 200 && json && json.success
  let reason = ''
  if (!ok) reason = await metaReason(name)
  if (ok) {
    const id = json.data.id
    const del = await call('DELETE', `/agents/${AGENT}/connectors/${CONNECTOR}/tools/${id}`)
    results.push({ group, label, ok, status, reason, cleanedUp: del.status === 200 })
  } else {
    results.push({ group, label, ok, status, reason, cleanedUp: 'n/a' })
  }
  const line = `${ok ? 'OK  ' : 'FAIL'} [${group}] ${label}${reason ? ' :: ' + reason.slice(0, 150) : ''}`
  console.log(line)
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

const jsonBody = (params, extra = {}) => ({ content_type: 'application/json', params, ...extra })
const scalar = (description = 'd') => ({ type: 'string', description })

async function main() {
  await login()

  // ---- 1. Body content types -------------------------------------------------
  for (const ct of [
    'application/json',
    'application/xml',
    'text/xml',
    'application/soap+xml',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ]) {
    await probe('content_type', ct, {
      method: 'POST',
      path: '/',
      body: { content_type: ct, params: { query: scalar('q') } },
    })
  }

  // ---- 2. Body structure -----------------------------------------------------
  await probe('structure', 'flat scalars', {
    method: 'POST', path: '/', body: jsonBody({ query: scalar(), n: { type: 'integer', description: 'd' } }),
  })
  await probe('structure', 'object, properties inline', {
    method: 'POST', path: '/',
    body: jsonBody({ home: { type: 'object', description: 'n', properties: { delhi: scalar() } } }),
  })
  await probe('structure', 'object, property values as JSON strings', {
    method: 'POST', path: '/',
    body: jsonBody({ home: { type: 'object', description: 'n', properties: { delhi: JSON.stringify(scalar()) } } }),
  })
  await probe('structure', 'object, whole properties as JSON string', {
    method: 'POST', path: '/',
    body: jsonBody({ home: { type: 'object', description: 'n', properties: JSON.stringify({ delhi: scalar() }) } }),
  })
  await probe('structure', 'array of scalars, items as JSON string', {
    method: 'POST', path: '/',
    body: jsonBody({ tags: { type: 'array', description: 'l', items: JSON.stringify(scalar('a tag')) } }),
  })
  await probe('structure', 'array of scalars, items inline object', {
    method: 'POST', path: '/', body: jsonBody({ tags: { type: 'array', description: 'l', items: scalar() } }),
  })
  await probe('structure', 'array of objects, nested props as JSON strings', {
    method: 'POST', path: '/',
    body: jsonBody({
      lines: {
        type: 'array', description: 'l',
        items: JSON.stringify({ type: 'object', description: 'a line', properties: { sku: JSON.stringify(scalar()) } }),
      },
    }),
  })
  await probe('structure', 'two-level object, values as JSON strings', {
    method: 'POST', path: '/',
    body: jsonBody({
      a: {
        type: 'object', description: 'l1',
        properties: { b: JSON.stringify({ type: 'object', description: 'l2', properties: { c: JSON.stringify(scalar()) } }) },
      },
    }),
  })
  await probe('structure', 'nested leaf carrying a fixed binding', {
    method: 'POST', path: '/',
    body: jsonBody({
      meta: {
        type: 'object', description: 'm',
        properties: { action: JSON.stringify({ type: 'string', description: 'fixed', binding: { kind: 'default', value: 'product-search' } }) },
      },
    }),
  })
  await probe('structure', 'body.required at top level', {
    method: 'POST', path: '/', body: jsonBody({ query: scalar() }, { required: ['query'] }),
  })

  // ---- 3. Methods ------------------------------------------------------------
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    await probe('method', method, { method, path: '/' })
  }
  await probe('method', 'GET with a body', {
    method: 'GET', path: '/', body: jsonBody({ query: scalar() }),
  })

  // ---- 4. Param types --------------------------------------------------------
  for (const type of ['string', 'integer', 'number', 'boolean', 'object', 'array']) {
    await probe('query param type', type, {
      method: 'GET', path: '/', query_parameters: { p: { type, description: 'd' } },
    })
  }
  await probe('query param', 'enum constraint', {
    method: 'GET', path: '/', query_parameters: { p: { type: 'string', description: 'd', enum: ['a', 'b'] } },
  })
  await probe('query param', 'same key in query and body', {
    method: 'POST', path: '/',
    query_parameters: { action: { type: 'string', binding: { kind: 'default', value: 'x' } } },
    body: jsonBody({ action: scalar() }),
  })

  // ---- 5. Bindings -----------------------------------------------------------
  for (const macro of ['WHATSAPP_PHONE_NUMBER', 'WHATSAPP_IDENTITY_HASH', 'WHATSAPP_CURRENT_STATUS_ID', 'NOT_A_REAL_MACRO']) {
    await probe('macro', macro, {
      method: 'GET', path: '/', query_parameters: { p: { type: 'string', description: 'd', binding: { kind: 'macro', macro } } },
    })
  }
  await probe('binding', 'fixed value on a header', {
    method: 'GET', path: '/', headers: { 'X-Fixed': { type: 'string', description: 'd', binding: { kind: 'default', value: 'v' } } },
  })
  await probe('binding', 'fixed value on a path param', {
    method: 'GET', path: '/thing/{id}',
    path_parameters: { id: { type: 'string', description: 'd', binding: { kind: 'default', value: '7' } } },
  })

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2))
  const failed = results.filter((r) => !r.ok).length
  const leaked = results.filter((r) => r.cleanedUp === false)
  console.log(`\n${results.length} probes, ${results.length - failed} accepted, ${failed} rejected`)
  if (leaked.length) console.log(`WARNING: ${leaked.length} probe tools failed to delete`)
  else console.log('all created probes deleted')
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
