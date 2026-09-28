#!/usr/bin/env node
/**
 * agent-ask.js — ask a real agent a real question, and read what it says.
 *
 * `meta-check.js` proves the read paths. This proves the thing the product is
 * actually for: that an agent answers, what it answers, and how long it makes
 * a customer wait.
 *
 * It goes through Meta's `agent_test` API, via our own backend, so it
 * exercises our auth, our scoping, our client and then Meta — the same path a
 * user's click takes. Meta states plainly that **tokens spent here are not
 * billed**, no consumer phone number is involved, and nothing is written. It is
 * the only way to see an agent's real words without messaging a real person.
 *
 * Every "not proven as behaviour" line in STATE.md was written while this
 * endpoint sat shipped and unused by any test since 2026-08.
 *
 * Limits Meta documents: 500 requests/hour per number, 10,000/hour per app.
 * The agent must be `active` — a draft is refused by our own backend.
 *
 * Usage:
 *   node scripts/agent-ask.js                          — list active agents
 *   node scripts/agent-ask.js <agentId> "msg" ["msg2"] — ask, multi-turn
 * Needs: frontend/.env.e2e with APP_USER / APP_PASSWORD
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

async function call(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { cookie: COOKIE, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let parsed = null
  try {
    parsed = await res.json()
  } catch {
    /* an error body is not always JSON */
  }
  return { status: res.status, raw: parsed, body: unwrap(parsed) }
}

function errorOf(r) {
  return (r.raw && (r.raw.error || r.raw.message)) || `HTTP ${r.status}`
}

async function main() {
  const env = credentials()
  if (!env) {
    console.log('No credentials. Set APP_USER / APP_PASSWORD in frontend/.env.e2e.')
    process.exit(1)
  }

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.APP_USER, password: env.APP_PASSWORD }),
  })
  if (!login.ok) {
    console.log(`login failed: ${login.status}`)
    process.exit(1)
  }
  COOKIE = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ')

  const agents = (await call('GET', '/agents')).body || []
  const active = agents.filter((a) => a.status === 'active')

  const [agentId, ...messages] = process.argv.slice(2)

  if (!agentId) {
    console.log('Active agents — the only ones Meta will answer for:\n')
    for (const a of active) {
      console.log(`  ${a.id}  ${String(a.displayName).padEnd(28)} ${a.displayPhoneNumber}`)
    }
    console.log(`\n  (${agents.length - active.length} more are drafts, which agent_test refuses)`)
    console.log('\nnode scripts/agent-ask.js <agentId> "your question" ["follow-up"]')
    return
  }

  const target = agents.find((a) => String(a.id) === String(agentId))
  if (!target) {
    console.log(`No agent ${agentId} on this account.`)
    process.exit(1)
  }

  console.log(`Asking ${target.displayName} (${target.displayPhoneNumber}), through the real agent.`)
  console.log('Not billed. No consumer messaged. Nothing written.\n')

  let conversationId = null
  let failures = 0

  for (const msg of messages.length ? messages : ['Hello']) {
    const started = Date.now()
    const r = await call('POST', `/agents/${target.id}/test`, { userMsg: msg, conversationId })
    const ms = Date.now() - started

    console.log(`> ${msg}`)
    if (r.status !== 200) {
      failures++
      console.log(`  !! ${errorOf(r)}  (${(ms / 1000).toFixed(1)}s)\n`)
      // A fresh conversation started moments after another one has been seen
      // to fail this way. Continuing an existing one does not — see below.
      continue
    }

    const d = r.body || {}
    conversationId = d.conversationId ?? conversationId
    console.log(`  ${String(d.agentResponse ?? '').trim() || '(no text)'}`)
    console.log(`  — ${(ms / 1000).toFixed(1)}s${d.handoffReason ? `, handoff: ${d.handoffReason}` : ''}${
      d.noResponseReason ? `, no response: ${d.noResponseReason}` : ''
    }`)
    if (d.quickReplies?.length) console.log(`  quick replies: ${d.quickReplies.join(' | ')}`)
    console.log()
  }

  console.log(
    'A customer waits this long for each reply. Measured 2026-09-24: about 15s for\n' +
      'the first message of a conversation, 8-9s for each one after it.'
  )
  if (failures) {
    console.log(
      `\n${failures} call(s) failed. Starting a SECOND fresh conversation within a\n` +
        'minute of the first returns a Meta 500 after ~31s — reproduced three times\n' +
        '2026-09-24, on the first call of a run and on a control. Continuing an\n' +
        'existing conversation with its conversationId does not fail. If you need\n' +
        'several fresh conversations, leave a gap between them.'
    )
  }
  process.exitCode = failures ? 1 : 0
}

main()
