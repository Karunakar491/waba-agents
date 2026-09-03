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
const TOOL_NAME = 'product_search'

/**
 * Reconfigures the IndiaMART product_search tool THROUGH THE UI — no direct API call —
 * to the request shape the partner's own curl uses:
 *
 *   POST /?action=product-search
 *   body {"action": "product-search", "query": "...", "city": "..."}
 *
 * `action` in the body must be a constant. Until `ToolBodyEditor` gained a fill control
 * (this deploy) that was not expressible in the UI at all, so this spec is also the
 * end-to-end proof of that control.
 *
 * Adding `city` is the actual bug fix: it filters server-side at IndiaMART, but was
 * undeclared on the tool, so Meta dropped it silently. See
 * docs/jobs/indiamart-api-contract-2026-09-04.md.
 */
test.describe('@indiamart-body configure product_search through the UI', () => {
  test.skip(
    !process.env.APP_USER || !process.env.APP_PASSWORD,
    'Set APP_USER and APP_PASSWORD (or frontend/.env.e2e) to run this.'
  )

  test('sets a fixed action plus agent-filled query and city in the request body', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox').first().fill(process.env.APP_USER!)
    await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD!)
    await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })

    await page.goto(`/agents/${AGENT_ID}`)
    await page.getByRole('button', { name: /^Connectors$/ }).first().click()

    // The connector row is collapsed by default; Tools only render once it is expanded,
    // and the Meta GET fires at that point.
    await page.getByLabel('Expand tools').first().click()

    const editTool = page.getByLabel(`Edit tool ${TOOL_NAME}`)
    await expect(editTool).toBeVisible({ timeout: 60_000 })
    await editTool.click()

    const modal = page.getByText(`Edit tool "${TOOL_NAME}"`)
    await expect(modal).toBeVisible({ timeout: 15_000 })

    // ---- Params tab: clear the query string entirely; every field moves into the body.
    //
    // The partner's curl sends action BOTH as ?action=product-search and in the body, but
    // Meta rejects the same key declared in query_parameters and body at once (verified:
    // that exact shape is the only one of four probes that returned 400). Body-only is the
    // working equivalent — the endpoint accepts action from either location, and a body
    // value wins over a query-string one of the same name anyway.
    await page.getByRole('button', { name: /^Params/ }).click()
    const removeQueryParam = page.getByLabel(/^Remove query parameter/i)
    for (let guard = 0; guard < 10 && (await removeQueryParam.count()) > 0; guard += 1) {
      await removeQueryParam.first().click()
    }
    await expect(page.locator('#query-parameters-0-key')).toHaveCount(0)

    // ---- Body tab: type the partner's exact payload, then declare who fills each field.
    await page.getByRole('button', { name: /^Body/ }).click()
    // Not a bare `textarea` — the modal also has the tool Description one.
    const jsonBox = page.locator('textarea[spellcheck="false"]')
    await expect(jsonBox).toHaveValue('{}') // no body configured today; this is the gap being closed
    await jsonBox.fill('{\n  "action": "product-search",\n  "query": "TMT Bars",\n  "city": "Delhi"\n}')
    await jsonBox.blur()

    // One row per field appears, in the JSON's own order.
    await expect(page.locator('#body-0-fill')).toBeVisible()
    await expect(page.locator('#body-2-fill')).toBeVisible()

    // action -> fixed constant. This is the control that did not exist before.
    await page.locator('#body-0-fill').selectOption('fixed')
    await page.locator('#body-0-fixedvalue').fill('product-search')
    await page.locator('#body-0-description').fill('Fixed action selector required by the endpoint.')

    await page
      .locator('#body-1-description')
      .fill('The product or service the buyer is searching for, e.g. Aata Chakki Machine.')
    await page
      .locator('#body-2-description')
      .fill('The city the buyer named, e.g. Delhi. Leave empty if the buyer gave no location.')

    // `query` is the one field the agent must supply — without it the endpoint returns
    // {"success":false,"message":"Query is required"}. `action` is injected by the binding
    // so it is always present, and `city` is genuinely optional.
    // Positional: unlike the fill/value/description controls in the same row, the Required
    // checkbox has no id to target. On the Body tab these three are the only checkboxes.
    const requiredBoxes = page.getByRole('checkbox')
    await expect(requiredBoxes).toHaveCount(3)
    await requiredBoxes.nth(1).check()
    await expect(requiredBoxes.nth(0)).not.toBeChecked()
    await expect(requiredBoxes.nth(2)).not.toBeChecked()

    await page.screenshot({
      path: resolve(ROOT, '../docs/e2e-test-runs/2026-09-04-tool-body-fixed-value.png'),
      fullPage: true,
    })

    page.on('response', async (r) => {
      if (r.url().includes('/tools/') && r.request().method() === 'PUT') {
        console.log(`PUT ${r.status()} -> ${(await r.text()).slice(0, 900)}`)
        console.log(`request body was -> ${r.request().postData()?.slice(0, 900)}`)
      }
    })

    await page.getByRole('button', { name: /^Save$/ }).click()

    // The modal closing is the app's own signal that the PUT succeeded — an error would
    // keep it open and render an ErrorBanner instead.
    await expect(modal).toBeHidden({ timeout: 30_000 })
    await expect(page.getByLabel(`Edit tool ${TOOL_NAME}`)).toBeVisible({ timeout: 30_000 })
  })
})
