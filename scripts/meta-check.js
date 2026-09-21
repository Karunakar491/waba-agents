#!/usr/bin/env node
/**
 * meta-check.js — validate against the real Meta API, not a mock.
 *
 * Founder, 2026-09-21: "You have to hit Meta APIs for validation not some
 * mockito or something."
 *
 * The argument is this product's own history. Between 2026-08-25 and 09-01 no
 * customer could create an agent, because Meta's `agent_config/settings` quietly
 * stopped creating the BizAI entity for a phone number that had never had one.
 * Eleven backend test files mock MetaApiClient. Every one of them stayed green
 * for that entire week, because a mocked Meta proves only that our code calls
 * our mock. It was found by calling Meta for real and reading the 500.
 *
 * This runs through the deployed backend rather than calling Graph directly, so
 * it exercises the same path a user's click does — our auth, our scoping, our
 * client, then Meta. A direct Graph call would validate Meta while skipping the
 * part of the stack that actually breaks.
 *
 * READ-ONLY. Every endpoint here is a GET. It creates nothing, changes nothing,
 * and sends no message. Anything that writes belongs in an e2e journey against
 * the reserved test number, not here.
 *
 * Usage:  node scripts/meta-check.js
 * Needs:  frontend/.env.e2e with APP_USER / APP_PASSWORD
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

const REPO = repoRoot()
const API = process.env.E2E_API_URL ?? 'https://app.karix.online/api/v1'

// The number reserved for testing. See STATE.md Constraints.
const TEST_PHONE_ID = '674661285722401'

function credentials() {
  const file = path.join(REPO, 'frontend', '.env.e2e')
  if (!fs.existsSync(file)) return null
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return env.APP_USER && env.APP_PASSWORD ? env : null
}

const unwrap = (r) => (r && r.data !== undefined ? r.data : r)
let COOKIE = ''

async function get(route) {
  const started = Date.now()
  const res = await fetch(`${API}${route}`, { headers: { cookie: COOKIE } })
  const ms = Date.now() - started
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { ok: res.ok, status: res.status, ms, body: unwrap(body) }
}

function line(label, r, detail = '') {
  const mark = r.ok ? 'OK' : '!!'
  console.log(`  ${mark} ${label.padEnd(42)} ${String(r.status).padEnd(4)} ${String(r.ms).padStart(5)}ms  ${detail}`)
}

async function main() {
  const env = credentials()
  if (!env) {
    console.log('No credentials. Set APP_USER / APP_PASSWORD in frontend/.env.e2e.')
    process.exit(1)
  }

  console.log(`Real Meta API check, through ${API}`)
  console.log('Read-only: every call is a GET. Nothing is created, changed or sent.\n')

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.APP_USER, password: env.APP_PASSWORD }),
  })
  if (!login.ok) {
    console.log(`!! login failed: ${login.status}`)
    process.exit(1)
  }
  COOKIE = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ')
  const me = unwrap(await login.json())
  console.log(`logged in as ${me.email}\n`)

  let failures = 0

  // 1. WABA list — local, but it is the handle everything else needs.
  console.log('ACCOUNT')
  const wabas = await get('/waba')
  const list = Array.isArray(wabas.body) ? wabas.body : []
  line('GET /waba', wabas, `${list.length} WABA(s)`)
  if (!wabas.ok) failures++

  // 2. Phones — this one genuinely calls Graph. quality_rating and status come
  //    back from Meta, and only from Meta: a mock cannot tell you a number went
  //    MIGRATED overnight, which is exactly what happened to +91 96422 01123.
  console.log('\nLIVE META READS')
  for (const w of list) {
    const id = w.wabaId || w.externalId || w.id
    const phones = await get(`/waba/${id}/phones`)
    const plist = Array.isArray(phones.body) ? phones.body : []
    line(`GET /waba/${id}/phones`, phones, `${plist.length} number(s) from Graph`)
    if (!phones.ok) failures++

    for (const p of plist) {
      const pid = String(p.phoneNumberId || p.id)
      if (p.qualityRating === undefined && p.status === undefined) {
        console.log(`     ! ${pid} returned neither status nor quality — Meta field set may have changed`)
        failures++
      }
    }
  }

  // 3. Deploy preflight for the reserved test number — the check a user's
  //    "deploy" click runs, and the one that returned a raw 500 for a week.
  const pre = await get(`/waba/phones/${TEST_PHONE_ID}/deploy-preflight`)
  line(`preflight on the test number`, pre, JSON.stringify(pre.body || {}).slice(0, 90))
  if (!pre.ok) failures++

  // 4. Agents, and their Meta-side identity.
  console.log('\nAGENTS')
  const agents = await get('/agents')
  const alist = Array.isArray(agents.body) ? agents.body : []
  line('GET /agents', agents, `${alist.length} agent(s)`)
  if (!agents.ok) failures++

  const live = alist.filter((a) => a.status === 'active')
  const missingMetaId = live.filter((a) => !a.metaAgentId)
  console.log(`  · ${live.length} active; ${missingMetaId.length} with no Meta agent id`)
  for (const a of missingMetaId) {
    console.log(`     ! "${a.displayName}" is active but has no metaAgentId — it exists here and not on Meta`)
    failures++
  }

  console.log(
    failures
      ? `\n${failures} problem(s) found against the real Meta API.`
      : '\nNo problems found against the real Meta API.'
  )
  console.log('This proves the read paths. Publish, deploy and send are writes —')
  console.log('they are proven by an e2e journey on the reserved test number, not here.')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.log('ERROR', e.message)
  process.exit(1)
})
