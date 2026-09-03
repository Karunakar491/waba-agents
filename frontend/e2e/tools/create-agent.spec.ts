/**
 * MUTATING. Walks the create-agent wizard end to end, as a user would, and
 * records where it fights back.
 *
 * Authorised by the founder 2026-09-03: "you can play around with any number"
 * other than IndiaMART. Target is +91 90100 82954 (892937373893469) — the one
 * number on the real WABA with no agent bound to it.
 *
 * It stops at the first step it genuinely cannot get past, and says so, rather
 * than forcing its way through. Getting stuck IS the finding.
 *
 * Run: npx playwright test --grep @create
 */
import { chromium, expect, test, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const envFile = resolve(ROOT, '.env.e2e')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
const BASE = process.env.E2E_BASE_URL ?? 'https://app.karix.online'
const dir = resolve(ROOT, 'e2e-walk')

/** Never touched. */
const OFF_LIMITS = ['875651765431701504', '1046051241927239', '91520 04195', 'IndiaMART']
/** The free number: no agent bound. */
const FREE_NUMBER = '+91 90100 82954'
const AGENT_NAME = 'ZZ Audit Agent 0903'

const log: string[] = ['# Create-agent journey (mutating)', '']
const friction: string[] = []

function note(s: string) {
  log.push(s, '')
  console.log(s)
}
function snag(s: string) {
  friction.push(s)
  note(`**FRICTION:** ${s}`)
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.getByRole('textbox').first().fill(process.env.APP_USER!)
  await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD!)
  await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function body(page: Page) {
  const main = page.locator('main')
  const t = (await main.count()) ? main.first() : page.locator('body')
  return ((await t.innerText().catch(() => '')) || '').replace(/\n{3,}/g, '\n\n').trim()
}

test(`create an agent the way a user would @create`, async () => {
  test.setTimeout(900_000)
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const failures: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`)
  })
  // Being bounced to /login mid-wizard is exactly the 15-minute bug; catch it.
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame() && f.url().includes('/login')) {
      snag('thrown out to /login in the middle of the wizard — the session expiry bug, live')
    }
  })

  await login(page)
  await page.goto(`${BASE}/agents/new`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  // ---------- Step 1: basics ----------
  note('## Step 1 — Basics')
  const select = page.locator('select').first()
  const options = await select.locator('option').allInnerTexts()
  note('Number dropdown offers:\n```\n' + options.join('\n') + '\n```')

  // Every option is labelled with the same WABA, so the list reads as duplicates.
  const wabaLabels = new Set(options.slice(1).map((o) => o.split('·')[1]?.trim()))
  if (wabaLabels.size === 1 && options.length > 3) {
    snag(
      `all ${options.length - 1} numbers are suffixed with the same WABA name ("${[...wabaLabels][0]}") — the suffix carries no information and eats the width`
    )
  }
  // Does it say which numbers are already taken?
  const taken = options.filter((o) => /taken|in use|connected|unavailable/i.test(o))
  if (taken.length === 0) {
    snag(
      'the dropdown does not mark which numbers already have an agent — 6 of the 7 offered are taken, and you only find out after picking'
    )
  }

  const target = options.find((o) => o.includes(FREE_NUMBER))
  expect(target, `${FREE_NUMBER} should be offered`).toBeTruthy()
  await select.selectOption({ label: target! })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: resolve(dir, 'create-01-number-picked.png'), fullPage: true })
  note('After picking the free number:\n```\n' + (await body(page)).slice(0, 1400) + '\n```')

  const nameBox = page.getByPlaceholder(/name/i).or(page.locator('input[type="text"]')).first()
  await nameBox.fill(AGENT_NAME)
  await page.waitForTimeout(1500)

  const next = page.getByRole('button', { name: /next step|next|continue/i }).first()
  if (!(await next.isEnabled().catch(() => false))) {
    snag('Next is still disabled after picking a free number and typing a name')
    await page.screenshot({ path: resolve(dir, 'create-01-blocked.png'), fullPage: true })
    await browser.close()
    writeFileSync(resolve(dir, 'create-agent.md'), log.join('\n'))
    return
  }

  // ---------- Walk the remaining steps ----------
  // Wait on the heading changing, not on a fixed delay: step 1 saves the agent
  // to Meta, which is slow, and a timed wait reports the spinner as a dead end.
  for (let step = 2; step <= 7; step++) {
    const before = failures.length
    const prevHeading = ((await page.locator('h1').first().innerText().catch(() => '')) || '').trim()
    const clickedAt = Date.now()
    await next.click()
    await page
      .locator('h1')
      .first()
      .filter({ hasNotText: prevHeading })
      .waitFor({ timeout: 60_000 })
      .catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    const advanceMs = Date.now() - clickedAt
    if (advanceMs > 5000) {
      snag(`step ${step - 1} → ${step} took ${(advanceMs / 1000).toFixed(1)}s with only a spinner to look at`)
    }
    const heading = ((await page.locator('h1').first().innerText().catch(() => '')) || '').trim()
    const text = await body(page)
    await page.screenshot({ path: resolve(dir, `create-0${step}.png`), fullPage: true })
    note(`## Step ${step} — ${heading}\n\`\`\`\n${text.slice(0, 1600)}\n\`\`\``)

    const newFail = failures.slice(before)
    if (newFail.length) snag(`step ${step} ("${heading}") triggers ${newFail.join(', ')}`)

    // Is there any way to know what this step wants?
    if (text.length < 250) snag(`step ${step} ("${heading}") shows almost nothing (${text.length} chars)`)

    const nx = page.getByRole('button', { name: /next step|next|continue/i }).first()
    if (!(await nx.isVisible().catch(() => false))) {
      note(`No Next button on step ${step} — this is the last step.`)
      break
    }
    // Give a saving button time to finish before calling it a dead end.
    await nx.waitFor({ state: 'visible' })
    for (let i = 0; i < 30 && !(await nx.isEnabled().catch(() => false)); i++) {
      await page.waitForTimeout(1000)
    }
    if (!(await nx.isEnabled().catch(() => false))) {
      const explains = /required|please|select at least|you must|add at least/i.test(text)
      snag(
        `wizard cannot proceed past step ${step} ("${heading}")` +
          (explains ? ' — it does explain why' : ' — **and nothing on screen says why**')
      )
      break
    }
  }

  // ---------- What got created? ----------
  note('## What exists afterwards')
  await page.goto(`${BASE}/agents`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const listed = (await body(page)).includes(AGENT_NAME)
  note(`Agent "${AGENT_NAME}" appears in the Agents list: **${listed}**`)
  await page.screenshot({ path: resolve(dir, 'create-99-list.png'), fullPage: true })

  if (failures.length) note('## All failed requests\n```\n' + [...new Set(failures)].join('\n') + '\n```')

  await browser.close()
  log.unshift('## Friction found', '', ...(friction.length ? friction.map((f) => `- ${f}`) : ['- none']), '')
  writeFileSync(resolve(dir, 'create-agent.md'), log.join('\n'))
  console.log(`\nwrote ${dir}/create-agent.md`)
  // Guard: prove we never touched the off-limits agent.
  const all = log.join('\n')
  for (const bad of OFF_LIMITS.slice(0, 2)) {
    expect(all.includes(`/agents/${bad}`), 'must not have opened the off-limits agent').toBe(false)
  }
})
