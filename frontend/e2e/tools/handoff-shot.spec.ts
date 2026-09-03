/**
 * Screenshot of the Webhooks tab with the handoff highlight, and of the
 * handoffs-only filter. Read-only; clicks tabs and one toggle.
 *
 * Run: npx playwright test --grep @handoffshot
 */
import { chromium, expect, test, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
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

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.getByRole('textbox').first().fill(process.env.APP_USER!)
  await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD!)
  await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

test(`handoff highlight and filter @handoffshot`, async () => {
  test.setTimeout(300_000)
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await login(page)

  await page.goto(`${BASE}/debug`)
  await page.getByRole('button', { name: /^webhooks$/i }).first().click()
  await page.waitForTimeout(6000)
  await page.screenshot({ path: resolve(dir, 'handoff-01-webhooks-tab.png'), fullPage: false })

  // The badge must actually be on screen — not just in the API response.
  const badge = page.getByText(/handed to a human/i).first()
  await expect(badge, 'the handoff badge should render on at least one row').toBeVisible({
    timeout: 20_000,
  })

  const toggle = page.getByRole('button', { name: /handoffs only/i })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await page.waitForTimeout(6000)
  await page.screenshot({ path: resolve(dir, 'handoff-02-filtered.png'), fullPage: false })

  const rows = page.locator('tbody tr')
  const count = await rows.count()
  console.log(`handoffs-only shows ${count} rows`)
  expect(count, 'the filter should return the handoff rows, not an empty table').toBeGreaterThan(0)

  await browser.close()
})
