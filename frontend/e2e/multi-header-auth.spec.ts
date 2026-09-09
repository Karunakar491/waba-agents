import { expect } from '@playwright/test'
import { test } from './fixtures/auth'
import {
  addActionInRow,
  chooseProperty,
  createThrowawayConnector,
  deleteOpenConnector,
} from './fixtures/connectors'

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

    // A new connector starts with no auth at all now: the create screen
    // collects a name, a description and a host, and nothing else.
    await createThrowawayConnector(page, CONNECTOR)
    const connectorUrl = page.url()

    // An action, because the credential lives on the screen where it is used —
    // an action's Authorization tab — and because Publish needs one later.
    await addActionInRow(page, {
      name: 'ping',
      path: '/ping',
      description: 'Checks the API answers.',
    })
    // The Actions table's row, not the sidebar's copy of the same name.
    await page
      .getByRole('region', { name: 'Actions' })
      .getByRole('button', { name: 'ping', exact: true })
      .click()
    await page.getByRole('tab', { name: 'Authorization' }).click()

    // It says out loud that this is shared, because it is the connector's.
    await expect(page.getByText(/Shared by all 1 action on this connector/i)).toBeVisible()

    // ---- two headers, which was impossible before -------------------------
    await chooseProperty(page, 'Auth', 'API_KEY')

    await page.getByLabel('Credential field 1').fill('X-Api-Key')
    await page.getByLabel('Prefix for credential 1').fill('Bearer')
    await page.getByRole('button', { name: /Add another header/i }).click()
    await page.getByLabel('Credential field 2').fill('X-Account-Id')

    // The value column never offers a place to type one.
    await expect(page.getByText(/Typed at publish — never stored here/).first()).toBeVisible()

    await page.getByRole('button', { name: /^Save connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Saved/i, { timeout: 20_000 })

    // ---- reload and confirm BOTH survived ---------------------------------
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: 'Authorization' }).click()

    await expect(page.getByLabel('Credential field 1')).toHaveValue('X-Api-Key', {
      timeout: 20_000,
    })
    await expect(page.getByLabel('Credential field 2')).toHaveValue('X-Account-Id')
    // The prefix rode along with its own header rather than being lost.
    await expect(page.getByLabel('Prefix for credential 1')).toHaveValue('Bearer')

    // ---- publishing asks for a value per header, and stores none ----------
    await page.goto(connectorUrl)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /^Publish$/ }).click()
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
