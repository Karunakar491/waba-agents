import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
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

const AGENT_ID = '875651765431701504' // IndiaMART Buyer Discovery

/**
 * READ ONLY. Opens nothing that writes — no Save, no Publish, no delete.
 * Answers one question with evidence instead of inference: which parts of this
 * agent's journey are actually editable from the UI, and how many of each exist.
 */
test.describe('@journey-audit what the UI can edit on a live agent', () => {
  test.skip(
    !process.env.APP_USER || !process.env.APP_PASSWORD,
    'Set APP_USER and APP_PASSWORD (or frontend/.env.e2e) to run this.'
  )

  test('inventories the edit affordances on skills, UI skills and connectors', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox').first().fill(process.env.APP_USER!)
    await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD!)
    await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })

    await page.goto(`/agents/${AGENT_ID}`)

    // ---- Skills ----
    await page.getByRole('button', { name: /^Skills$/ }).first().click()
    await page.waitForTimeout(6000)
    const skillEdit = await page.getByLabel(/^Edit skill/i).count()
    const uiSkillEdit = await page.getByLabel(/^Edit UI skill|^Edit ui-skill/i).count()
    const anyEditButtons = await page.getByLabel(/^Edit /i).count()
    console.log(`SKILLS TAB: edit-skill=${skillEdit} edit-ui-skill=${uiSkillEdit} any-edit-labels=${anyEditButtons}`)
    const labels = await page.getByLabel(/^Edit /i).evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label'))
    )
    console.log(`SKILLS TAB labels: ${JSON.stringify(labels)}`)
    await page.screenshot({ path: resolve(ROOT, '../docs/e2e-test-runs/2026-09-04-skills-tab.png'), fullPage: true })

    // The skill row itself is the edit affordance — there is no pencil icon, which is why
    // an aria-label search finds nothing. Open it, screenshot, then CANCEL. Never save.
    await page.getByText('supplier-search-invocation-new').first().click()
    const skillModal = page.getByText(/Edit skill|supplier-search-invocation-new/i).first()
    await expect(skillModal).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: resolve(ROOT, '../docs/e2e-test-runs/2026-09-04-skill-editor.png'), fullPage: true })
    const cancel = page.getByRole('button', { name: /^Cancel$/ })
    if (await cancel.count()) await cancel.first().click()
    else await page.keyboard.press('Escape')

    // UI skills live further down the same tab.
    await page.getByRole('button', { name: /^Skills$/ }).first().click()
    await page.waitForTimeout(4000)
    await page.mouse.wheel(0, 4000)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(ROOT, '../docs/e2e-test-runs/2026-09-04-ui-skills.png'), fullPage: true })

    // ---- Connectors ----
    await page.getByRole('button', { name: /^Connectors$/ }).first().click()
    await page.getByLabel('Expand tools').first().click()
    await expect(page.getByLabel(/^Edit tool/i).first()).toBeVisible({ timeout: 60_000 })
    const connectorLabels = await page.getByLabel(/^Edit |^Delete |^Add /i).evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label'))
    )
    console.log(`CONNECTORS TAB labels: ${JSON.stringify(connectorLabels)}`)
    await page.screenshot({ path: resolve(ROOT, '../docs/e2e-test-runs/2026-09-04-connectors-tab.png'), fullPage: true })
  })
})
