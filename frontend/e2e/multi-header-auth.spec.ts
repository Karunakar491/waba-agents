import { expect } from '@playwright/test'
import { test } from './fixtures/auth'
import { createThrowawayConnector, deleteOpenConnector } from './fixtures/connectors'

/**
 * Proves a connector can carry more than one credential header.
 *
 * Meta's api_key auth config takes an array and the backend has always built
 * one — publishing even prompts for a value per header. The form was the only
 * thing insisting on a single pair, and it read only headers[0], so an API
 * needing a key plus an account id could not be configured at all, and a
 * connector that somehow had two would silently save back one.
 *
 * Writes, scoped like the other write specs: a connector in our own library,
 * obviously named, never published, deleted at the end. No credential value is
 * ever typed — only header names, which is all the library stores.
 *
 * Tagged @multi-auth.
 */
const CONNECTOR = 'zz-two-headers (safe to delete)'

test.describe('@multi-auth more than one credential header', () => {
  test('two headers save, come back, and are both asked for when publishing', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000)

    // The helper creates it with one header and leaves us on its page.
    await createThrowawayConnector(page, CONNECTOR)
    const connectorUrl = page.url()

    // ---- add a second header, which was impossible before -----------------
    // Auth is its own tab now, the way a Postman collection's is.
    await page.getByRole('tab', { name: 'Authorization' }).click()
    await page.getByPlaceholder(/^Prefix, e.g. Bearer/).first().fill('Bearer')
    await page.getByRole('button', { name: /Add another header/i }).click()
    const names = page.locator('input[placeholder="e.g. X-API-Key"]')
    await expect(names).toHaveCount(2)
    await names.nth(1).fill('X-Account-Id')

    await page.getByRole('button', { name: /^Save connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/saved/i, { timeout: 20_000 })

    // ---- reload and confirm BOTH survived ---------------------------------
    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'Authorization' }).click()
    const reopened = page.locator('input[placeholder="e.g. X-API-Key"]')
    await expect(reopened).toHaveCount(2, { timeout: 20_000 })
    await expect(reopened.nth(0)).toHaveValue('X-Api-Key')
    await expect(reopened.nth(1)).toHaveValue('X-Account-Id')
    // The prefix rode along with its own header rather than being lost.
    await expect(page.locator('input[placeholder^="Prefix"]').nth(0)).toHaveValue('Bearer')

    // ---- publishing asks for a value per header, and stores none ----------
    await page.getByRole('tab', { name: 'Agents' }).click()
    await page.getByRole('button', { name: /Publish to an agent/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/Value for X-Api-Key/i)).toBeVisible()
    await expect(dialog.getByText(/Value for X-Account-Id/i)).toBeVisible()
    await page.keyboard.press('Escape')

    // ---- clean up ---------------------------------------------------------
    await page.goto(connectorUrl)
    await page.waitForLoadState('networkidle')
    await deleteOpenConnector(page)
  })
})
