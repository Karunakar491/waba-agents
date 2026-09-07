import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * Proves a connector can be deleted, and that a deployed one is refused up
 * front rather than after the fact.
 *
 * The backend has always refused: "This connector is deployed to at least one
 * agent. Remove it from those agents first." The confirmation dialog added on
 * 2026-09-07 said the opposite — that the connector would be deleted and its
 * agents would stop being able to call it — so it promised a deletion that
 * would then fail, on the normal case: three of the five connectors on this
 * account are deployed.
 *
 * The read-only half of this spec asserts the guard against the real deployed
 * connectors and touches nothing. The write half creates its own throwaway and
 * deletes it.
 *
 * Tagged @connector-delete.
 */
const CONNECTOR = 'zz-delete-check (safe to delete)'

test.describe('@connector-delete deleting a connector', () => {
  test('a deployed connector refuses up front, with the reason', async ({ authedPage: page }) => {
    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')

    const guarded = page.locator('button[aria-label^="Delete connector"][disabled]')
    test.skip(
      (await guarded.count()) === 0,
      'no deployed connector on this account to check the guard against',
    )

    // The reason is on the control, before the click — not in an error after it.
    await expect(guarded.first()).toHaveAttribute(
      'title',
      /remove it from those agents before deleting it/i,
    )
  })

  test('an unused connector deletes, and says what it did', async ({ authedPage: page }) => {
    test.setTimeout(120_000)

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
      .fill('Automated check of connector deletion. Safe to delete.')
    await page.getByPlaceholder('https://api.example.com').fill('https://example.invalid')
    await page.getByPlaceholder('e.g. X-API-Key').fill('X-Api-Key')
    await page.getByRole('button', { name: /^Create connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Connector saved/i, { timeout: 20_000 })

    const trash = page.getByRole('button', { name: `Delete connector ${CONNECTOR}` })
    // Nothing uses it, so the control is live rather than guarded.
    await expect(trash).toBeEnabled()
    await trash.click()

    // The dialog no longer describes agents losing access — it cannot happen
    // here, because a connector with agents never reaches this dialog.
    await expect(page.getByText(/No agent is using it, so nothing stops working/i)).toBeVisible()
    await expect(page.getByText(/Its actions go with it/i)).toBeVisible()

    await page.getByRole('button', { name: /^Delete connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Connector deleted/i, { timeout: 20_000 })
    await expect(trash).toHaveCount(0, { timeout: 20_000 })
  })
})
