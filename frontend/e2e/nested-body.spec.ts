import { expect } from '@playwright/test'
import { test } from './fixtures/auth'
import { createThrowawayConnector, deleteOpenConnector } from './fixtures/connectors'

/**
 * Proves an enterprise-shaped body — nested objects and a list of objects —
 * can be configured in the UI and survives a round trip through storage.
 *
 * The editor refused anything nested until 2026-09-07, with "flat fields only —
 * for a nested object or list, contact engineering". That was a self-imposed
 * limit: Meta accepts nested bodies, string-encoded at each level, verified
 * against the live API across 39 shapes
 * (docs/meta-api/connector-tools-capability-matrix.md).
 *
 * Writes, scoped like the other write specs: a connector in our own library,
 * obviously named, never published — so it reaches no Meta object, no agent and
 * no phone number. It deletes what it created.
 *
 * What this does NOT prove: that Meta accepts this exact payload. Storage is
 * ours; the encoding is pinned by unit tests against the shape Meta was
 * observed to enforce.
 *
 * Tagged @nested-body.
 */
const CONNECTOR = 'zz-nested-body-check (safe to delete)'
const ACTION = 'create_order'

const PAYLOAD = `{
  "customer": { "id": 1024, "vip": true },
  "lines": [{ "sku": "TMT-12", "qty": 2 }],
  "tags": ["urgent"],
  "note": "leave at gate"
}`

test.describe('@nested-body an enterprise payload can be configured', () => {
  test('nested objects and lists survive being saved and reopened', async ({ authedPage: page }) => {
    test.setTimeout(180_000)

    // Leaves the browser on the new connector's own page.
    await createThrowawayConnector(page, CONNECTOR)
    const connectorUrl = page.url()

    // ---- add an action with a nested body ---------------------------------
    await page.getByRole('button', { name: /^Add an action$/ }).last().click()
    await page.getByPlaceholder('e.g. product_search').fill(ACTION)
    await page.getByPlaceholder(/Search the catalogue/i).fill('Creates an order with nested lines.')
    await page.locator('#wb-method').selectOption('POST')
    await page.locator('#wb-path').fill('/orders')
    await page.getByRole('tab', { name: /^Body/ }).click()

    const bodyBox = page.locator('textarea[placeholder*="customer"]')
    await bodyBox.fill(PAYLOAD)
    await bodyBox.blur()

    // The tree the paste produced. Before this change, blurring here raised
    // "flat fields only" and no rows appeared at all.
    await expect(page.getByText('list of object')).toBeVisible()
    await expect(page.getByText('list of string')).toBeVisible()
    // A container offers no "who fills this in" — there is nothing to fill.
    await expect(page.locator('#body-0-fill')).toHaveCount(0)
    // A nested leaf does.
    await expect(page.locator('#body-0-0-fill')).toBeVisible()

    await page.getByRole('button', { name: /^Add action$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Action added/i, { timeout: 20_000 })

    // ---- reopen and confirm the shape came back ---------------------------
    // Saving gives the action its own URL, so a reload is the reopen.
    await expect(page).toHaveURL(/\/actions\/\d+$/)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByPlaceholder('e.g. product_search')).toHaveValue(ACTION, {
      timeout: 20_000,
    })
    await page.getByRole('tab', { name: /^Body/ }).click()
    await expect(page.getByText('list of object')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('list of string')).toBeVisible()

    // By shape, not by position: field order is not preserved across storage —
    // a JSON object has no order — so asserting "#body-0-0-fill" only passed by
    // luck before saving and failed after. What matters is that nested leaves
    // came back at all, each with its own fill control.
    const ids = await page
      .locator('select[id^="body-"]')
      .evaluateAll((nodes) => nodes.map((n) => n.id))
    expect(ids.filter((id) => /^body-\d+-\d+-fill$/.test(id)).length).toBeGreaterThanOrEqual(4)

    // The list's item fields are rebuilt from the string-encoded items node.
    await expect(page.getByText('sku', { exact: true })).toBeVisible()
    await expect(page.getByText('qty', { exact: true })).toBeVisible()
    await expect(page.getByText('vip', { exact: true })).toBeVisible()

    // ---- clean up ---------------------------------------------------------
    await page.goto(connectorUrl)
    await page.waitForLoadState('networkidle')
    await deleteOpenConnector(page)
  })
})
