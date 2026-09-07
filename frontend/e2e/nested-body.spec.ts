import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * Proves an enterprise-shaped body — nested objects and a list of objects —
 * can be configured in the UI and survives a round trip through storage.
 *
 * The editor refused anything nested until now, with "flat fields only — for a
 * nested object or list, contact engineering". That was a self-imposed limit:
 * Meta accepts nested bodies, string-encoded at each level, verified against the
 * live API across 39 shapes (docs/meta-api/connector-tools-capability-matrix.md).
 *
 * This writes, and is scoped like the feedback spec: a connector in our own
 * library, obviously named, never deployed — so it reaches no Meta object, no
 * agent and no phone number. It deletes what it created.
 *
 * What this does NOT prove: that Meta accepts this exact payload. Storage is
 * ours; the encoding is pinned by unit tests against the shape Meta was observed
 * to enforce. A live re-validation needs a throwaway tool on a paused agent.
 *
 * Tagged @nested-body, out of every default suite.
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

    // ---- create a throwaway connector -------------------------------------
    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')

    const existing = page.getByRole('button', { name: `Delete connector ${CONNECTOR}` })
    if ((await existing.count()) > 0) {
      await existing.first().click()
      await page.getByRole('button', { name: /^Delete connector$/ }).click()
      await expect(existing).toHaveCount(0, { timeout: 20_000 })
    }

    await page.getByRole('button', { name: /New connector/i }).click()
    await page.getByPlaceholder('e.g. Shopify Order Management').fill(CONNECTOR)
    await page
      .getByPlaceholder(/Checks real order and delivery status/i)
      .fill('Automated check of nested request bodies. Safe to delete.')
    await page.getByPlaceholder('https://api.example.com').fill('https://example.invalid')
    await page.getByPlaceholder('e.g. X-API-Key').fill('X-Api-Key')
    await page.getByRole('button', { name: /^Create connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Connector saved/i, { timeout: 20_000 })

    // ---- add an action with a nested body ---------------------------------
    // Scoped to the row we just created. An earlier version of this took the
    // first Edit link in the table and wrote its action onto a real connector —
    // "Google Sheets Export" — which had to be cleaned up by hand. A test that
    // touches the wrong production row is worse than no test.
    await page
      .locator('tr', { hasText: CONNECTOR })
      .getByRole('link', { name: 'Edit' })
      .click()
    await expect(page).toHaveURL(/\/library\/connectors\/\d+/)
    await expect(page.getByRole('heading', { name: CONNECTOR })).toBeVisible()
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /Add an action/i }).click()
    await page.locator('#action-name').fill(ACTION)
    await page.locator('#action-description').fill('Creates an order with nested lines.')
    await page.locator('#action-method').selectOption('POST')
    await page.locator('#action-path').fill('/orders')

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

    // ---- reopen it and confirm the shape came back ------------------------
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(ACTION).first()).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: `Edit action ${ACTION}` }).click()
    await expect(page.getByText('list of object')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('list of string')).toBeVisible()

    // By shape, not by position: field order is not preserved across storage —
    // a JSON object has no order — so asserting "#body-0-0-fill" only passed by
    // luck before saving and failed after. What matters is that nested leaves
    // came back at all, each with its own fill control.
    const nestedFills = page.locator('select[id^="body-"]')
    const ids = await nestedFills.evaluateAll((nodes) => nodes.map((n) => n.id))
    expect(ids.filter((id) => /^body-\d+-\d+-fill$/.test(id)).length).toBeGreaterThanOrEqual(4)

    // The list's item fields are rebuilt from the string-encoded items node.
    await expect(page.getByText('sku', { exact: true })).toBeVisible()
    await expect(page.getByText('qty', { exact: true })).toBeVisible()
    await expect(page.getByText('vip', { exact: true })).toBeVisible()

    // ---- clean up ---------------------------------------------------------
    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: `Delete connector ${CONNECTOR}` }).click()
    await page.getByRole('button', { name: /^Delete connector$/ }).click()
    await expect(page.getByRole('button', { name: `Delete connector ${CONNECTOR}` })).toHaveCount(0, {
      timeout: 20_000,
    })
  })
})
