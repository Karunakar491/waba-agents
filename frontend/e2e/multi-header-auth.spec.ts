import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * Proves a connector can carry more than one credential header.
 *
 * Meta's api_key auth config takes an array and the backend has always built
 * one — deploy even prompts for a value per header. The form was the only thing
 * insisting on a single pair, and it read only headers[0], so an API needing a
 * key plus an account id could not be configured at all, and a connector that
 * somehow had two would silently save back one.
 *
 * Writes, scoped like the other write specs: a connector in our own library,
 * obviously named, never deployed, deleted at the end. No value is ever typed —
 * only header names, which is all the library stores.
 *
 * Tagged @multi-auth.
 */
const CONNECTOR = 'zz-two-headers (safe to delete)'

test.describe('@multi-auth more than one credential header', () => {
  test('two headers save, come back, and are both asked for at deploy', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000)

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
      .fill('Automated check of multi-header API key auth. Safe to delete.')
    await page.getByPlaceholder('https://api.example.com').fill('https://example.invalid')

    // First header.
    await page.getByPlaceholder('e.g. X-API-Key').fill('X-Api-Key')
    await page.getByPlaceholder(/^Prefix, e.g. Bearer/).first().fill('Bearer')

    // A second one — the whole point.
    await page.getByRole('button', { name: /Add another header/i }).click()
    const names = page.locator('input[placeholder="e.g. X-API-Key"]')
    await expect(names).toHaveCount(2)
    await names.nth(1).fill('X-Account-Id')

    await page.getByRole('button', { name: /^Create connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Connector saved/i, { timeout: 20_000 })

    // ---- reopen and confirm BOTH survived ---------------------------------
    await page.locator('tr', { hasText: CONNECTOR }).getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/library\/connectors\/\d+$/)
    await page.waitForLoadState('networkidle')

    const reopened = page.locator('input[placeholder="e.g. X-API-Key"]')
    await expect(reopened).toHaveCount(2, { timeout: 20_000 })
    await expect(reopened.nth(0)).toHaveValue('X-Api-Key')
    await expect(reopened.nth(1)).toHaveValue('X-Account-Id')
    // The prefix rode along with its own header rather than being lost.
    await expect(page.locator('input[placeholder^="Prefix"]').nth(0)).toHaveValue('Bearer')

    // ---- deploy asks for a value per header, and stores none --------------
    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')
    await page.locator('tr', { hasText: CONNECTOR }).getByRole('button', { name: /Deploy/ }).click()
    await expect(page.getByText(/Value for X-Api-Key/i)).toBeVisible()
    await expect(page.getByText(/Value for X-Account-Id/i)).toBeVisible()
    await page.keyboard.press('Escape')

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
