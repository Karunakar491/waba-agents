import { expect, type Page } from '@playwright/test'

/**
 * Creating and removing a throwaway connector, in one place.
 *
 * Five specs needed this and each carried its own copy, which meant that when
 * the Connectors screen became the workbench — no list page, no table rows, no
 * per-row Edit link — all five broke in the same way at once. One helper is one
 * thing to fix next time.
 *
 * Every connector these make is named so a human seeing it on the account knows
 * it is disposable, and none is ever published, so no Meta object, agent or
 * phone number is touched.
 */

/** Removes a leftover from an interrupted run, if one is there. */
export async function removeConnectorIfPresent(page: Page, name: string): Promise<void> {
  await page.goto('/library/connectors')
  await page.waitForLoadState('networkidle')

  const inTree = page.locator('div.w-72 button', { hasText: name })
  if ((await inTree.count()) === 0) return

  await inTree.first().click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/)
  await deleteOpenConnector(page)
}

/**
 * Creates one and leaves the browser on its page.
 *
 * The API-key header is filled because the panel refuses to save without one
 * and says so — satisfying it here keeps every caller from repeating that.
 */
export async function createThrowawayConnector(
  page: Page,
  name: string,
  description = 'Created by an automated check. Safe to delete.',
): Promise<void> {
  await removeConnectorIfPresent(page, name)

  // The sidebar's "+". The main pane's empty state offers the same thing, which
  // is fine for a user and ambiguous for a test, so this says which.
  await page.locator('div.w-72').getByRole('button', { name: 'New connector' }).click()
  await expect(page).toHaveURL(/\/library\/connectors\/new$/)

  await page.getByPlaceholder('e.g. Shopify Order Management').fill(name)
  await page.getByPlaceholder(/Checks real order and delivery status/i).fill(description)
  await page.getByPlaceholder('https://api.example.com').fill('https://example.invalid')
  await page.getByPlaceholder('e.g. X-API-Key').fill('X-Api-Key')

  await page.getByRole('button', { name: /^Create connector$/ }).click()
  await expect(page.getByRole('status')).toContainText(/Connector saved/i, { timeout: 20_000 })
  // Saving navigates to the connector's own page, so callers can act on it.
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 20_000 })
}

/**
 * Deletes the connector currently open, asserting it is gone.
 *
 * The pane's button and the dialog's confirm are both called "Delete
 * connector", so each is addressed by where it is rather than by name alone.
 */
export async function deleteOpenConnector(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Delete connector$/ }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /^Delete connector$/ }).click()
  await expect(page.getByRole('status')).toContainText(/Connector deleted/i, { timeout: 20_000 })
  await expect(page).toHaveURL(/\/library\/connectors$/, { timeout: 20_000 })
}
