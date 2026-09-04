/**
 * Can a Meta connector tool consume an XML *response*?
 *
 * Sending an XML request body is already proven impossible (content_type is an
 * enum of one). This tests the other half, which was untested: an endpoint that
 * takes GET with no body and returns application/xml.
 *
 * Target is httpbin.org (public, no auth). Runs on the PAUSED agent, never the
 * IndiaMART one. Everything created is torn down at the end.
 */
const fs = require('fs')

const BASE = 'https://app.karix.online/api/v1'
const AGENT = '875641528037412864' // paused, published to Meta
const WABA = '875612227057487872'
const OFF_LIMITS = ['875651765431701504', '1046051241927239']
if (OFF_LIMITS.includes(AGENT)) throw new Error('refusing to touch the IndiaMART agent')

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
  cookie = (r.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ')
  if (!cookie) throw new Error('no cookie, status ' + r.status)
}

async function call(method, path, body, retry = true) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (r.status === 401 && retry) { await login(); return call(method, path, body, false) }
  let json = null
  try { json = await r.json() } catch {}
  return { status: r.status, json }
}

async function metaReason(marker) {
  const { json } = await call('GET', '/reports/api-calls?limit=80')
  const rows = (json && json.data) || []
  const hit = rows.find((x) => x.statusCode >= 400 && (x.requestBody || '').includes(marker))
  if (!hit) return ''
  let b = hit.responseBody
  try { b = JSON.parse(b) } catch {}
  try { const o = typeof b === 'string' ? JSON.parse(b) : b; return o.detail || o.title || '' } catch { return String(b).slice(0, 300) }
}

const created = { libraryId: null, metaConnectorId: null, toolIds: [] }

async function main() {
  await login()

  // ---- 1. library connector, no auth, pointing at httpbin
  let r = await call('POST', '/connector-library', {
    wabaId: WABA,
    name: 'zz_xml_probe',
    description: 'Temporary probe: can a tool consume an XML response? Safe to delete.',
    baseUrl: 'https://httpbin.org',
    authType: 'NONE',
    requiresCertificate: false,
  })
  console.log('create library connector:', r.status, r.json && r.json.success ? 'OK' : JSON.stringify(r.json))
  if (!(r.json && r.json.success)) return
  created.libraryId = r.json.data.id
  console.log('  libraryId =', created.libraryId)

  r = await call('POST', `/connector-library/${created.libraryId}/publish`)
  console.log('publish:', r.status, r.json && r.json.success ? 'OK' : JSON.stringify(r.json).slice(0, 300))

  r = await call('POST', `/connector-library/${created.libraryId}/deploy`, { agentId: AGENT, secrets: {} })
  console.log('deploy:', r.status, r.json && r.json.success ? 'OK' : JSON.stringify(r.json).slice(0, 400))
  if (!(r.json && r.json.success)) { await cleanup(); return }
  created.metaConnectorId = r.json.data.metaConnectorId
  console.log('  metaConnectorId =', created.metaConnectorId, ' status =', r.json.data.status, r.json.data.lastError || '')
  if (!created.metaConnectorId) { console.log('  no meta connector id — cannot add tools'); await cleanup(); return }

  // ---- 2. two tools on the same connector: one XML endpoint, one JSON control
  const targets = [
    { name: 'zz_xml_returns_xml', path: '/xml', why: 'returns application/xml' },
    { name: 'zz_xml_returns_json', path: '/json', why: 'returns application/json (control)' },
  ]
  for (const t of targets) {
    const res = await call('POST', `/agents/${AGENT}/connectors/${created.metaConnectorId}/tools`, {
      name: t.name,
      description: `Temporary probe — ${t.why}. Safe to delete.`,
      user_auth_required: false,
      request_definition: { method: 'GET', path: t.path },
    })
    const ok = res.json && res.json.success
    console.log(`create tool ${t.name}: ${res.status} ${ok ? 'OK' : 'FAIL ' + (await metaReason(t.name))}`)
    if (ok) { created.toolIds.push(res.json.data.id); t.id = res.json.data.id }
  }

  // ---- 3. run each and show EXACTLY what the agent receives
  for (const t of targets) {
    if (!t.id) continue
    const res = await call('POST', `/agents/${AGENT}/connectors/${created.metaConnectorId}/tools/${t.id}/run`, { input: '{}' })
    console.log(`\n=== RUN ${t.name} (${t.why}) -> http ${res.status}`)
    if (!(res.json && res.json.success)) { console.log('  API said:', JSON.stringify(res.json).slice(0, 400)); continue }
    const raw = res.json.data.output
    console.log('  tool status field:', res.json.data.status)
    let out = raw
    try { out = JSON.parse(raw) } catch {}
    console.log('  output.status:', JSON.stringify(out && out.status))
    const body = out && out.body !== undefined ? out.body : out
    console.log('  body typeof:', typeof body)
    console.log('  body (first 700 chars):')
    console.log('  ' + String(typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 700).replace(/\n/g, '\n  '))
  }

  await cleanup()
}

async function cleanup() {
  console.log('\n--- cleanup ---')
  for (const id of created.toolIds) {
    const r = await call('DELETE', `/agents/${AGENT}/connectors/${created.metaConnectorId}/tools/${id}`)
    console.log('delete tool', String(id).slice(0, 12), r.status)
  }
  if (created.metaConnectorId) {
    const r = await call('DELETE', `/agents/${AGENT}/connectors/${created.metaConnectorId}`)
    console.log('delete agent connector deployment:', r.status)
  }
  if (created.libraryId) {
    const r = await call('DELETE', `/connector-library/${created.libraryId}`)
    console.log('delete library connector:', r.status)
  }
  const after = await call('GET', `/agents/${AGENT}/connectors`)
  const list = (after.json && after.json.data) || []
  console.log('connectors left on the paused agent:', Array.isArray(list) ? list.map((c) => c.name).join(', ') || '(none)' : 'n/a')
  const lib = await call('GET', `/connector-library?wabaId=${WABA}`)
  const libRows = (lib.json && lib.json.data) || []
  const leftovers = libRows.filter((c) => String(c.name).startsWith('zz_'))
  console.log('zz_ library leftovers:', leftovers.length ? leftovers.map((c) => c.name + ':' + c.id).join(', ') : 'none')
}

main().catch(async (e) => { console.error('FATAL', e); try { await cleanup() } catch {} process.exit(1) })
