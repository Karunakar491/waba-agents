import { expect } from '@playwright/test'
import { test } from './fixtures/auth'
import {
  addAction,
  createThrowawayConnector,
  deleteOpenConnector,
  openConnectorPage,
} from './fixtures/connectors'

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

    await createThrowawayConnector(page, CONNECTOR)

    // createThrowawayConnector leaves us on the connector's own page.
    await expect(page).toHaveURL(/\/library\/connectors\/\d+$/)
    const connectorUrl = page.url()

    // ---- the connector is ONE page ----------------------------------------
    // It had five section pills — Actions, Details, Authorization, Variables,
    // Agents — and everything they led to is now on the page at once. That is
    // the assertion: no clicking, no tab row, all four things visible
    // together. "When someone clicks on actions why are other sections
    // closed?" cannot be asked of a page with no sections.
    await expect(page.getByPlaceholder('https://api.example.com')).toBeVisible()
    await expect(page.getByText(/Headers that carry a credential/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Variables you can substitute/ })).toBeVisible()
    await expect(page.getByText('WHATSAPP_PHONE_NUMBER')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible()

    // And only ONE tab row is ever on screen — the connector has none, so
    // "Authorization" and "Headers" appear once each rather than twice.
    await expect(page.getByRole('tablist')).toHaveCount(0)

    // ---- add an action ----------------------------------------------------
    // The Actions table's own control, always there rather than appearing only
    // once the table is non-empty. It opens as its own view because the editor
    // has a tab row, and nesting it put two rows on screen.
    await addAction(page)
    await expect(page.getByPlaceholder('e.g. product_search')).toBeVisible()

    // The breadcrumb's connector name is the way back, and it lands on the
    // whole connector rather than on one remembered section.
    await openConnectorPage(page)
    await expect(page.getByText('WHATSAPP_IDENTITY_HASH')).toBeVisible()
    await addAction(page)

    // Save is refused with the reason stated, not silently disabled.
    await expect(page.getByText(/Still needed:/)).toBeVisible()

    await page.getByPlaceholder('e.g. product_search').fill(ACTION)

    // The description is on Docs, Postman's home for it, and the Still-needed
    // line has to name the tab or Save is a dead button with no explanation.
    await expect(page.getByText(/Still needed:.*Docs tab/)).toBeVisible()
    await page.getByRole('tab', { name: 'Docs' }).click()
    await page
      .getByPlaceholder(/Search the catalogue/i)
      .fill('Looks up one order by its id and reports the delivery status.')

    // Auth is reported, not editable — Meta has no per-tool auth override.
    await page.getByRole('tab', { name: 'Authorization' }).click()
    await expect(page.getByText(/Inherited from the connector/i)).toBeVisible()

    // Method + path live on one bar.
    await page.locator('#wb-method').selectOption('POST')
    await page.locator('#wb-path').fill('/orders/{order_id}')

    // A path token becomes a parameter row without being asked for twice.
    await page.getByRole('tab', { name: /^Params/ }).click()
    await expect(page.getByText('Path parameters', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: 'e2e-shots/wb-action-params.png' })

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
    await page.goto(connectorUrl)
    await page.waitForLoadState('networkidle')
    await deleteOpenConnector(page)
  })
})
