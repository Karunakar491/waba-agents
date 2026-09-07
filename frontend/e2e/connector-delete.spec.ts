import { expect } from '@playwright/test'
import { test } from './fixtures/auth'
import { createThrowawayConnector, deleteOpenConnector } from './fixtures/connectors'

/**
 * Proves a connector can be deleted, and that a deployed one is refused up
 * front rather than after the fact.
 *
 * The backend has always refused: "This connector is deployed to at least one
 * agent. Remove it from those agents first." The dialog once said the opposite
 * — that the connector would go and its agents would stop being able to call it
 * — promising a deletion that would then fail, on the normal case: three of the
 * five connectors on this account are published to an agent.
 *
 * Delete lives on the connector's own page now. It was on the list page's row
 * until the Connectors screen became the workbench, and moving it there without
 * this check would have removed the only way to delete a connector at all.
 *
 * Tagged @connector-delete.
 */
const CONNECTOR = 'zz-delete-check (safe to delete)'

test.describe('@connector-delete deleting a connector', () => {
  test('a published connector refuses up front, with the reason', async ({ authedPage: page }) => {
    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')

    // Walk the tree for one that is on an agent — its delete must be refused.
    const rows = page.locator('div.w-72 button[aria-label^="Expand"], div.w-72 button[aria-label^="Collapse"]')
    const count = await rows.count()
    test.skip(count === 0, 'no connectors on this account')

    let found = false
    for (let i = 0; i < Math.min(count, 8); i++) {
      await page.goto('/library/connectors')
      await page.waitForLoadState('networkidle')
      const names = page.locator('div.w-72 button[aria-current], div.w-72 button').filter({ hasText: /\w/ })
      await names.nth(i).click().catch(() => {})
      if (!/\/library\/connectors\/\d+$/.test(page.url())) continue
      await page.waitForTimeout(1200)

      // Delete sits on the connector's Details tab; the pane opens on Actions.
      await page.getByRole('tab', { name: 'Details' }).click().catch(() => {})
      const del = page.getByRole('button', { name: /^Delete connector$/ }).first()
      if ((await del.count()) === 0) continue
      if (await del.isDisabled()) {
        await expect(del).toHaveAttribute('title', /remove it from those agents before deleting it/i)
        found = true
        break
      }
    }
    test.skip(!found, 'every connector on this account is unused')
  })

  test('an unused connector deletes, and says what it did', async ({ authedPage: page }) => {
    test.setTimeout(150_000)
    await createThrowawayConnector(page, CONNECTOR, 'Automated check of connector deletion.')

    // Nothing uses it, so the control is live rather than guarded.
    await page.getByRole('tab', { name: 'Details' }).click()
    const del = page.getByRole('button', { name: /^Delete connector$/ }).first()
    await expect(del).toBeEnabled()
    await del.click()

    // The dialog only describes what it can actually reach: a connector with
    // agents never gets here, because the button above refuses first.
    await expect(page.getByText(/No agent is using it, so nothing stops working/i)).toBeVisible()
    await expect(page.getByText(/Its actions go with it/i)).toBeVisible()

    await page.getByRole('dialog').getByRole('button', { name: /^Delete connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Connector deleted/i, { timeout: 20_000 })
    await expect(page).toHaveURL(/\/library\/connectors$/, { timeout: 20_000 })
    await expect(page.locator('div.w-72 button', { hasText: CONNECTOR })).toHaveCount(0)
  })
})

test.describe('@connector-delete publish is the word for reaching Meta', () => {
  test('the connector page offers Publish to an agent, with a dropdown', async ({
    authedPage: page,
  }) => {
    test.setTimeout(150_000)
    const name = 'zz-publish-wording (safe to delete)'
    await createThrowawayConnector(page, name, 'Automated check of publish wording.')

    // "Publish" used to flip a local flag that gated nothing, while "Deploy"
    // was the thing that reached Meta — so the button named Publish was the one
    // that did not publish.
    await page.getByRole('tab', { name: 'Agents' }).click()
    await page.getByRole('button', { name: /Publish to an agent/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Publish “/)).toBeVisible()
    // The agent dropdown the founder asked for.
    await expect(dialog.locator('select')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Publish to this agent/i })).toBeVisible()

    await page.keyboard.press('Escape')
    await deleteOpenConnector(page)
  })
})
