/**
 * Targeted verification of four suspicious results from walk2, with screenshots
 * and a real wait rather than networkidle — so "renders nothing" is a finding
 * about the app and not about my timing.
 *
 * Read-only. Clicks tabs and one conversation; saves nothing.
 *
 * Run: npx playwright test --grep @walk3
 */
import { chromium, expect, test, type Page } from '@playwright/test'
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
const LIVE_AGENT = '882515538725572608'
const OFF_LIMITS = ['875651765431701504', '1046051241927239', '91520 04195']
const dir = resolve(ROOT, 'e2e-walk')

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.getByRole('textbox').first().fill(process.env.APP_USER!)
  await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD!)
  await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

test(`verify the suspicious screens @walk3`, async () => {
  test.setTimeout(300_000)
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const report: string[] = ['# Verification of walk2 suspicions', '']
  const failed: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(BASE, '')}`)
  })
  await login(page)

  // ---- The three tabs that appeared to render nothing. ----
  await page.goto(`${BASE}/agents/${LIVE_AGENT}`)
  for (const tab of ['Skills', 'Business Persona', 'Eval', 'Knowledge Base']) {
    const before = failed.length
    await page.getByRole('button', { name: tab, exact: true }).first().click()
    // Give it a real chance: 6s of settling, not just the first idle moment.
    await page.waitForTimeout(6000)
    const panel = page.locator('main')
    const text = ((await panel.innerText().catch(() => '')) || '')
      // strip the header + tab strip, which every tab repeats
      .split(/\n/)
      .slice(12)
      .join('\n')
      .trim()
    const slug = tab.toLowerCase().replace(/\s+/g, '-')
    await page.screenshot({ path: resolve(dir, `tab-${slug}.png`), fullPage: true })
    report.push(
      `## Agent tab: ${tab}`,
      `content below the tab strip: **${text.length} chars**`,
      '```',
      text.slice(0, 1500) || '(EMPTY — nothing rendered)',
      '```',
      failed.slice(before).length ? `failed requests: ${failed.slice(before).join(', ')}` : '',
      `screenshot: e2e-walk/tab-${slug}.png`,
      ''
    )
  }

  // ---- Opening a conversation: does a message pane appear? ----
  await page.goto(`${BASE}/inbox`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const before = failed.length
  const threads = page.getByRole('button').filter({ hasText: /\d{2}:\d{2} (am|pm)/i })
  const total = await threads.count()
  let chosen = ''
  for (let i = 0; i < Math.min(total, 12); i++) {
    const label = ((await threads.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
    if (OFF_LIMITS.some((b) => label.includes(b))) continue
    chosen = label
    await threads.nth(i).click()
    break
  }
  await page.waitForTimeout(6000)
  await page.screenshot({ path: resolve(dir, 'inbox-thread.png'), fullPage: true })
  const url = page.url()
  const full = ((await page.locator('main').innerText().catch(() => '')) || '').trim()
  report.push(
    '## Opening a conversation',
    `clicked: ${chosen.slice(0, 90)}`,
    `url after click: ${url.replace(BASE, '')}`,
    `total main text: ${full.length} chars`,
    failed.slice(before).length ? `failed requests: ${failed.slice(before).join(', ')}` : 'no failed requests',
    'screenshot: e2e-walk/inbox-thread.png',
    ''
  )

  await browser.close()
  writeFileSync(resolve(dir, 'walk3.md'), report.join('\n'))
  console.log(report.join('\n'))
  expect(true).toBe(true)
})
