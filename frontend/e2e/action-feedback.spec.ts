import { expect } from '@playwright/test'
import { test } from './fixtures/auth'
import { openConnectorPage, removeConnectorIfPresent, setProperty } from './fixtures/connectors'

/**
 * Proves that a completed action now says so, and that deleting a connector
 * asks first.
 *
 * This one writes, unlike the other audit specs — there is no way to prove a
 * success confirmation without succeeding at something. It is deliberately
 * scoped to the safest write in the product: a connector in **our own library**
 * with an obvious throwaway name. Creating one touches no Meta object, no agent
 * and no live phone number; a library connector only reaches Meta when it is
 * deployed, which this never does.
 *
 * It deletes what it created, and asserts it is gone. If the delete assertion
 * ever fails, a stray connector is left behind on the account — visible, named,
 * and safe, but it should be removed by hand.
 *
 * Tagged @feedback and kept out of every suite that runs by default.
 */
const NAME = 'zz-feedback-check (safe to delete)'

test.describe('@feedback a finished action says so', () => {
  test('saving a connector confirms, and deleting one asks first', async ({ authedPage: page }) => {
    test.setTimeout(120_000)

    await removeConnectorIfPresent(page, NAME)

    await page.locator('div.w-72').getByRole('button', { name: 'New connector' }).click()

    // The New connector screen is the same property table the saved connector
    // shows, so each row is clicked and then typed into.
    await setProperty(page, 'Name', NAME)
    await setProperty(
      page,
      'Description',
      'Created by an automated check of the success-confirmation mechanism. Safe to delete.',
    )

    // It says what is still missing rather than leaving a dead button — assert
    // that, then satisfy it. A credential is no longer among them: auth moved
    // to an action's Authorization tab, where it is used.
    await expect(page.getByText(/Still needed:/)).toContainText(/base URL/i)
    await setProperty(page, 'Base URL', 'https://example.invalid')
    await expect(page.getByText(/Still needed:/)).toHaveCount(0)

    await page.getByRole('button', { name: /^Create connector$/ }).click()

    // The whole point: the action confirms itself. Before this existed, the
    // panel simply closed and the user was left inferring.
    const status = page.getByRole('status')
    await expect(status).toContainText(/Connector saved/i, { timeout: 20_000 })
    // And it says what it affected, not just "Success".
    await expect(status).toContainText(NAME)

    // Deleting used to fire on the first click, unlike every other delete here.
    // It sits at the foot of the connector's page.
    await openConnectorPage(page)
    await page.getByRole('button', { name: /^Delete connector$/ }).first().click()
    await expect(page.getByText(/This cannot be undone/i)).toBeVisible()
    await expect(page.getByText(/No agent is using it, so nothing stops working/i)).toBeVisible()

    await page.getByRole('dialog').getByRole('button', { name: /^Delete connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Connector deleted/i, { timeout: 20_000 })
    await expect(page.locator('div.w-72 button', { hasText: NAME })).toHaveCount(0, {
      timeout: 20_000,
    })
  })
})

test.describe('@feedback the silent Disconnect is gone', () => {
  test('an agent page no longer offers a Disconnect that does nothing', async ({
    authedPage: page,
  }) => {
    await page.goto('/agents')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tbody tr').first()
    test.skip((await row.count()) === 0, 'no agents on this account')
    await row.click()
    await expect(page).toHaveURL(/\/agents\/\d+/)
    await page.waitForLoadState('networkidle')

    // The button had an empty handler with a TODO in it. It is removed, not
    // hidden — "Remove from Meta" is the real control and says what it does.
    await expect(page.getByRole('button', { name: /^Disconnect$/ })).toHaveCount(0)
  })
})
