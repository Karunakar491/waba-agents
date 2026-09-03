/**
 * Second pass: goes inside the screens instead of just landing on them.
 *
 * Pass one (walk.spec.ts) proved several pages render almost nothing. This one
 * captures their full text so the emptiness can be judged rather than guessed,
 * clicks through every tab on a live agent, and steps the create-agent wizard.
 *
 * Read-only. It clicks navigation (tabs, Next Step) and reads. It never saves,
 * publishes, deletes or types into a field that persists.
 *
 * Run: npx playwright test --grep @walk2
 * Output: e2e-walk/walk2.md
 */
import { chromium, test, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')

const envFile = resolve(ROOT, '.env.e2e')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const BASE = process.env.E2E_BASE_URL ?? 'https://app.karix.online'
const USER = process.env.APP_USER!
const PASS = process.env.APP_PASSWORD!

/** Off-limits by founder instruction: the IndiaMART agent and its number. */
const OFF_LIMITS = ['875651765431701504', '1046051241927239', '91520 04195']

/** A live agent on the account's real WABA, safe to open and read. */
const LIVE_AGENT = '882515538725572608'

const out: string[] = [`# Inside the screens — ${BASE}`, '']
const problems: string[] = []

function guard(s: string) {
  for (const bad of OFF_LIMITS) {
    if (s.includes(bad)) throw new Error(`refusing to touch off-limits target: ${s}`)
  }
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.getByRole('textbox').first().fill(USER)
  await page.locator('input[type="password"]').fill(PASS)
  await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

/** Body text minus the persistent app shell, so "what's on this screen" is honest. */
async function screenText(page: Page): Promise<string> {
  const main = page.locator('main')
  const target = (await main.count()) ? main.first() : page.locator('body')
  return ((await target.innerText().catch(() => '')) || '').replace(/\n{3,}/g, '\n\n').trim()
}

test(`look inside the screens @walk2`, async () => {
  test.setTimeout(600_000)
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const failed: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(BASE, '')}`)
  })

  await login(page)

  // ---- 1. The pages that rendered almost nothing. Show their whole content. ----
  out.push('## Pages that render almost nothing', '')
  for (const route of ['/handover', '/profile', '/templates', '/reports', '/wabas/494227720434920']) {
    guard(route)
    await page.goto(`${BASE}${route}`)
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const text = await screenText(page)
    out.push(`### ${route}`, '```', text || '(nothing at all)', '```', '')
    if (text.length < 200) problems.push(`${route} shows only ${text.length} characters of content`)
  }

  // ---- 2. Every tab on a live agent. ----
  guard(LIVE_AGENT)
  out.push('## Tabs on a live agent (/agents/' + LIVE_AGENT + ')', '')
  await page.goto(`${BASE}/agents/${LIVE_AGENT}`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  for (const tab of ['Knowledge Base', 'Skills', 'Connectors', 'Business Persona', 'Eval', 'Settings']) {
    const before = failed.length
    const btn = page.getByRole('button', { name: tab, exact: true }).first()
    if (!(await btn.isVisible().catch(() => false))) {
      out.push(`### ${tab}`, '_tab not found on the page_', '')
      problems.push(`agent tab "${tab}" is not reachable`)
      continue
    }
    await btn.click()
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const text = await screenText(page)
    const newFailures = failed.slice(before)
    out.push(
      `### ${tab}`,
      '```',
      text.slice(0, 1800) || '(nothing at all)',
      '```',
      newFailures.length ? `**Failed requests:** ${newFailures.join(', ')}` : '',
      ''
    )
    if (text.length < 200) problems.push(`agent tab "${tab}" shows only ${text.length} characters`)
    if (newFailures.length) problems.push(`agent tab "${tab}" triggers ${newFailures.join(', ')}`)
  }

  // ---- 3. The create-agent wizard, step by step. Never submitted. ----
  out.push('## Create-agent wizard, step by step (never saved)', '')
  await page.goto(`${BASE}/agents/new`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  for (let step = 1; step <= 8; step++) {
    const text = await screenText(page)
    const heading = (await page.locator('h1, h2').first().innerText().catch(() => '')) || '(no heading)'
    const next = page.getByRole('button', { name: /next step|next|continue/i }).first()
    const nextEnabled = await next.isEnabled().catch(() => false)
    out.push(
      `### Step ${step}: ${heading.replace(/\s+/g, ' ').trim()}`,
      '```',
      text.slice(0, 1200),
      '```',
      `Next button ${nextEnabled ? 'enabled' : '**disabled**'}`,
      ''
    )
    if (!(await next.isVisible().catch(() => false))) break
    if (!nextEnabled) {
      // A wizard that blocks here with no stated reason is the finding.
      const said = /required|please|select|enter|choose/i.test(text)
      problems.push(
        `create-agent wizard stops at step ${step} ("${heading.trim()}")` +
          (said ? ' — it does say what is needed' : ' — **with no message saying what is needed**')
      )
      break
    }
    await next.click()
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    if (page.url().includes('/agents/new') === false) break
  }

  // ---- 4. Open a conversation in the inbox. ----
  out.push('## Opening a conversation', '')
  await page.goto(`${BASE}/inbox`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  // Pick a thread that is not on the off-limits number.
  const threads = page.getByRole('button').filter({ hasText: /\d{2}:\d{2} (am|pm)/i })
  const count = await threads.count()
  let opened = false
  for (let i = 0; i < Math.min(count, 12); i++) {
    const label = (await threads.nth(i).innerText().catch(() => '')) || ''
    if (OFF_LIMITS.some((b) => label.includes(b))) continue
    await threads.nth(i).click()
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    out.push(`### Thread: ${label.replace(/\s+/g, ' ').slice(0, 80)}`, '```', (await screenText(page)).slice(0, 2500), '```', '')
    opened = true
    break
  }
  if (!opened) problems.push('could not open any conversation in the inbox')

  await browser.close()

  const dir = resolve(ROOT, 'e2e-walk')
  mkdirSync(dir, { recursive: true })
  out.unshift(
    '## Problems this pass found',
    '',
    ...(problems.length ? problems.map((p) => `- ${p}`) : ['- none']),
    ''
  )
  writeFileSync(resolve(dir, 'walk2.md'), out.join('\n'))
  console.log('\n' + problems.map((p) => '! ' + p).join('\n'))
  console.log(`\nwrote ${dir}/walk2.md`)
})
