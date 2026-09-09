import { test } from '../fixtures/auth'
import { expect } from '@playwright/test'
import { connectorSection } from '../fixtures/connectors'

/**
 * Screenshots of both Postman-shaped panes, for reviewing the layout.
 *
 * Read-only: it opens the first connector on the account and its first action,
 * clicks between tabs and photographs them. It saves nothing, publishes
 * nothing and deletes nothing, so it is safe against the real connectors on
 * this shared production box.
 *
 * Tagged @shotswb, out of every default suite.
 */
test.describe('@shotswb the workbench, photographed', () => {
  test('connector tabs and action tabs', async ({ authedPage: page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')

    // Walk the tree for a connector that HAS actions — photographing an empty
    // one shows the empty state, not the table, and the table is the point.
    const names = page.locator('div.w-72 button').filter({ hasText: /\w/ })
    const total = await names.count()
    let opened = false
    for (let i = 1; i < Math.min(total, 10); i++) {
      await page.goto('/library/connectors')
      await page.waitForLoadState('networkidle')
      await page.locator('div.w-72 button').filter({ hasText: /\w/ }).nth(i).click()
      if (!/\/library\/connectors\/\d+$/.test(page.url())) continue

      // A connector opens on Details, so ask for Actions. On one with none
      // that redirects into the request editor — which is the answer to "does
      // this connector have any", and cheaper than waiting for a table that
      // will never appear.
      await connectorSection(page, 'Actions').click()
      await expect(
        page.locator('table').or(page.getByPlaceholder('e.g. product_search')).first(),
      ).toBeVisible({ timeout: 20_000 })
      if ((await page.locator('table tbody tr').count()) > 0) {
        opened = true
        break
      }
    }
    test.skip(!opened, 'no connector on this account has an action')
    await expect(page).toHaveURL(/\/library\/connectors\/\d+\?section=actions$/)
    await page.screenshot({ path: 'e2e-shots/wb-connector-actions.png' })

    for (const tab of ['Details', 'Authorization', 'Variables', 'Agents']) {
      await connectorSection(page, tab).click()
      // The underline transitions colour; shooting instantly catches two tabs
      // mid-fade and reads like a bug in the screenshot.
      await page.waitForTimeout(400)
      await page.screenshot({ path: `e2e-shots/wb-connector-${tab.toLowerCase()}.png` })
    }

    // An action, if this connector has one.
    await connectorSection(page, 'Actions').click()
    const action = page.locator('table tbody tr button').first()
    await action.click()
    await expect(page).toHaveURL(/\/actions\/\d+$/)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'e2e-shots/wb-action-params.png' })

    // The action's own tabs, which are a real tablist — unlike the connector's
    // sections above, which are header navigation.
    for (const tab of ['Authorization', 'Headers', 'Docs']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
      // The underline transitions colour; shooting instantly catches two tabs
      // mid-fade and reads like a bug in the screenshot.
      await page.waitForTimeout(400)
      await page.screenshot({ path: `e2e-shots/wb-action-${tab.toLowerCase()}.png` })
    }
  })
})
