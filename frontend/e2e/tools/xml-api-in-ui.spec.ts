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

/** Paused, published to Meta. Never the IndiaMART agent. */
const AGENT = '875641528037412864'
const OFF_LIMITS = ['875651765431701504', '1046051241927239']

const CONNECTOR = 'zz_xml_ui_probe'
const TOOL = 'zz_get_slideshow_xml'

/**
 * Configures an XML-returning API entirely through the UI, runs it, and captures
 * what comes back — then deletes both objects it created.
 *
 * Exists to answer one question with a screenshot instead of an assurance: can an
 * operator wire up a non-JSON API without engineering? XML *responses* are fine
 * (Meta hands them through as a raw string); only an XML request *body* is
 * impossible. See docs/meta-api/connector-tools-capability-matrix.md.
 */
test.describe('@xml-ui configure an XML API through the UI', () => {
  test.skip(
    !process.env.APP_USER || !process.env.APP_PASSWORD,
    'Set APP_USER and APP_PASSWORD (or frontend/.env.e2e) to run this.'
  )

  test('an operator can add the connector, add a GET tool, run it and see XML', async ({ page }) => {
    for (const bad of OFF_LIMITS) expect(AGENT).not.toBe(bad)
    test.setTimeout(300_000)

    await page.goto('/login')
    await page.getByRole('textbox').first().fill(process.env.APP_USER!)
    await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD!)
    await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })

    await page.goto(`/agents/${AGENT}`)
    await page.getByRole('button', { name: /^Connectors$/ }).first().click()

    // ---- 0. Remove a probe connector left behind by an earlier failed run.
    // Without this, creation fails with a bare "Meta API error: 409" (the name is
    // already taken) and the modal just sits there — which is exactly how this test
    // failed the first time.
    // Wait for the list to actually render first — checking .count() before the Meta
    // GET resolves always returns 0, which silently skipped this whole block and let
    // the run fail on a name conflict instead.
    await expect(
      page.getByRole('button', { name: /Add Connector/i }).or(page.getByText(/no connectors/i)).first()
    ).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(5000)

    const stale = page.getByLabel(`Delete connector ${CONNECTOR}`)
    if (await stale.count()) {
      await stale.first().click()
      const confirmStale = page.getByRole('button', { name: /^Delete connector$/ })
      if (await confirmStale.count()) await confirmStale.first().click()
      await expect(page.getByText(CONNECTOR, { exact: true })).toHaveCount(0, { timeout: 60_000 })
    }

    // ---- 1. Add the connector: name, description, base URL, no auth.
    await page.getByRole('button', { name: /Add Connector/i }).click()
    await page.getByPlaceholder('e.g. Order Management API').fill(CONNECTOR)
    await page
      .getByPlaceholder('The agent reads this to understand what the connector does')
      .fill('Temporary probe for an XML-returning API. Safe to delete.')
    await page.getByPlaceholder('https://api.example.com/v1').fill('https://httpbin.org')
    await page.getByRole('combobox').first().selectOption('NONE')
    // "Publish connector", not Add/Save — this app labels creation "Publish" in
    // several places (also "Publish changes" on a skill, "Publish & Test" on an agent).
    await page.getByRole('button', { name: /^Publish connector$/ }).click()

    const connectorRow = page.getByText(CONNECTOR, { exact: true })
    await expect(connectorRow).toBeVisible({ timeout: 60_000 })

    // ---- 2. Add a GET tool. No body at all, which is why XML is not a problem.
    await page.getByLabel('Expand tools').last().click()
    await page.getByRole('button', { name: /Add Tool/i }).last().click()

    // Not getByText('Add Tool') — that matches the button as well as the modal title.
    // Waiting on a field inside the modal is unambiguous.
    const toolName = page.getByPlaceholder(/check_order_status|e\.g\./i).first()
    await expect(toolName).toBeVisible({ timeout: 15_000 })
    await toolName.fill(TOOL)
    await page
      .locator('textarea')
      .first()
      .fill('Returns a slideshow document. The response is XML, not JSON — read it as XML text.')

    // Method GET, path /xml. GET hides the body editor entirely.
    const selects = page.getByRole('combobox')
    await selects.first().selectOption('GET')
    await page.getByPlaceholder(/^\/|path/i).first().fill('/xml')

    await page.screenshot({ path: resolve(ROOT, '../docs/e2e-test-runs/2026-09-04-xml-tool-config.png'), fullPage: true })
    await page.getByRole('button', { name: /^Add$/ }).click()
    await expect(page.getByLabel(`Edit tool ${TOOL}`)).toBeVisible({ timeout: 60_000 })

    // ---- 3. Run it from the UI and read the response out of the modal.
    await page.getByLabel(`Run tool ${TOOL}`).click()
    await page.getByRole('button', { name: /^Run$/ }).click()

    const output = page.locator('pre')
    await expect(output).toBeVisible({ timeout: 90_000 })
    await expect(output).toContainText('slideshow', { timeout: 90_000 })
    const text = await output.textContent()
    console.log('RUN OUTPUT (first 500):', (text ?? '').slice(0, 500))

    // Assert on the XML declaration WITHOUT the angle bracket: the panel renders the
    // raw JSON envelope, in which "<" is escaped as <. So a literal "<?xml" never
    // appears even though the document is right there. That escaping is a genuine
    // readability defect in the Run panel, logged separately — an operator cannot read
    // the response they just fetched.
    expect(text, 'the XML document should arrive in the run output').toContain('?xml version')
    expect(text, 'the escaped form is what the panel actually shows today').toContain('\\u003C')
    expect(text).toContain('WonderWidgets')

    await page.screenshot({ path: resolve(ROOT, '../docs/e2e-test-runs/2026-09-04-xml-tool-run.png'), fullPage: true })

    // ---- 4. Tear down what this test created, through the UI.
    const close = page.getByRole('button', { name: /^(Close|Cancel|Done)$/ })
    if (await close.count()) await close.first().click()
    else await page.keyboard.press('Escape')

    await page.getByLabel(`Delete tool ${TOOL}`).click()
    const confirmTool = page.getByRole('button', { name: /^Delete tool$/ })
    if (await confirmTool.count()) await confirmTool.first().click()
    await expect(page.getByLabel(`Edit tool ${TOOL}`)).toHaveCount(0, { timeout: 60_000 })

    await page.getByLabel(`Delete connector ${CONNECTOR}`).click()
    const confirmConn = page.getByRole('button', { name: /^Delete connector$/ })
    if (await confirmConn.count()) await confirmConn.first().click()
    await expect(page.getByText(CONNECTOR, { exact: true })).toHaveCount(0, { timeout: 60_000 })
  })
})
