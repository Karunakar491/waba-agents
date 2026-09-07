import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * Proves the workbench: the tree, the request bar, the tabs, and that an action
 * saved through it comes back.
 *
 * Writes, and scoped like the other write specs — a connector in our own
 * library with an obvious throwaway name, never deployed, so it reaches no Meta
 * object, no agent and no phone number. It deletes what it created.
 *
 * Every selector below is scoped to the row or pane it belongs to. An earlier
 * spec of mine took "the first Edit link in the table" and wrote its action onto
 * a real connector, which had to be cleaned up by hand.
 *
 * Tagged @workbench, out of every default suite.
 */
const CONNECTOR = 'zz-workbench-check (safe to delete)'
const ACTION = 'lookup_order'

test.describe('@workbench the connector workbench', () => {
  test('tree, request bar and tabs all work, and an action round-trips', async ({
    authedPage: page,
  }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1440, height: 900 })

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
      .fill('Automated check of the connector workbench. Safe to delete.')
    await page.getByPlaceholder('https://api.example.com').fill('https://example.invalid')
    await page.getByPlaceholder('e.g. X-API-Key').fill('X-Api-Key')
    await page.getByRole('button', { name: /^Create connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Connector saved/i, { timeout: 20_000 })

    // Open OUR row, not the first one in the table.
    await page.locator('tr', { hasText: CONNECTOR }).getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/library\/connectors\/\d+$/)

    // ---- the connector side -----------------------------------------------
    // No tabs here any more. Details, auth and where it runs are all on the
    // one page — the Auth tab used to be a signpost to the Details tab, which
    // is a tab whose content is directions to other content.
    await expect(page.getByRole('heading', { name: /What it can do/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Where it runs/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /how it signs in/i })).toBeVisible()
    // Auth is part of the definition, so its fields are right here.
    await expect(page.getByText(/Headers that carry a credential/i)).toBeVisible()

    // An empty connector says so, in both the tree and the page.
    await expect(page.getByText(/can't do anything yet/i)).toBeVisible()

    // ---- add an action ----------------------------------------------------
    // Two entry points exist — the tree and the page — which is fine; the
    // test has to say which one it means. This is the page's.
    await page.getByRole('button', { name: /^Add an action$/ }).last().click()
    await expect(page).toHaveURL(/\/actions\/new$/)

    // Save is refused with the reason stated, not silently disabled.
    await expect(page.getByText(/Still needed:/)).toBeVisible()

    await page.getByPlaceholder('e.g. product_search').fill(ACTION)
    await page
      .getByPlaceholder(/Search the catalogue/i)
      .fill('Looks up one order by its id and reports the delivery status.')

    // Method + path live on one bar.
    await page.locator('#wb-method').selectOption('POST')
    await page.locator('#wb-path').fill('/orders/{order_id}')

    // A path token becomes a parameter row without being asked for twice.
    await expect(page.getByText("Path parameters", { exact: true }).first()).toBeVisible()

    // Body is available for POST; it is disabled for GET with a reason.
    await expect(page.getByRole('tab', { name: /^Body/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await page.locator('#wb-method').selectOption('GET')
    await expect(page.getByRole('tab', { name: /^Body/ })).toHaveAttribute('aria-disabled', 'true')
    await page.locator('#wb-method').selectOption('POST')

    await page.getByRole('tab', { name: /^Body/ }).click()
    const bodyBox = page.locator('textarea[placeholder*="customer"]')
    await bodyBox.fill('{ "order": { "id": 42 } }')
    await bodyBox.blur()
    await expect(page.getByText('object', { exact: true })).toBeVisible()

    await page.screenshot({ path: 'e2e-shots/wb-action.png' })

    await page.getByRole('button', { name: /^Add action$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Action added/i, { timeout: 20_000 })
    // It gets a real URL of its own, so a reload lands back on it.
    await expect(page).toHaveURL(/\/actions\/\d+$/)

    // ---- reload and confirm it came back ----------------------------------
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByPlaceholder('e.g. product_search')).toHaveValue(ACTION, {
      timeout: 20_000,
    })
    await expect(page.locator('#wb-path')).toHaveValue('/orders/{order_id}')
    await expect(page.locator('#wb-method')).toHaveValue('POST')

    // ---- clean up ---------------------------------------------------------
    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: `Delete connector ${CONNECTOR}` }).click()
    await page.getByRole('button', { name: /^Delete connector$/ }).click()
    await expect(page.getByRole('button', { name: `Delete connector ${CONNECTOR}` })).toHaveCount(
      0,
      { timeout: 20_000 },
    )
  })
})
