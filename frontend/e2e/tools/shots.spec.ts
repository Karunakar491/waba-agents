/**
 * Screenshots of the screens a user lives in, for judging by eye rather than
 * by character count. Read-only.
 *
 * Run: npx playwright test --grep @shots
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

test(`screenshot the daily screens @shots`, async () => {
  test.setTimeout(300_000)
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await login(page)

  const shots: [string, string][] = [
    ['/agents', 'agents-list'],
    ['/dashboard', 'dashboard'],
    ['/agents/new', 'create-wizard-step1'],
    ['/library/persona', 'persona-library'],
    ['/library/skills', 'skills-library'],
    ['/library/connectors', 'connectors-library'],
  ]
  for (const [route, name] of shots) {
    await page.goto(`${BASE}${route}`)
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await page.screenshot({ path: resolve(dir, `${name}.png`), fullPage: true })
    console.log(`shot ${name}`)
  }
  await browser.close()
  expect(true).toBe(true)
})
