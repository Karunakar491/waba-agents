import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

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

    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')

    // Clean up after an earlier interrupted run before adding another.
    const existing = page.getByRole('button', { name: `Delete connector ${NAME}` })
    if ((await existing.count()) > 0) {
      await existing.first().click()
      await page.getByRole('button', { name: /^Delete connector$/ }).click()
      await expect(existing).toHaveCount(0, { timeout: 20_000 })
    }

    await page.getByRole('button', { name: /New connector/i }).click()

    // By placeholder, not label: "Name" matches more than one control on this
    // page, and the placeholders are unique.
    await page.getByPlaceholder('e.g. Shopify Order Management').fill(NAME)
    await page
      .getByPlaceholder(/Checks real order and delivery status/i)
      .fill('Created by an automated check of the success-confirmation mechanism. Safe to delete.')
    await page.getByPlaceholder('https://api.example.com').fill('https://example.invalid')

    // The panel now says what is still missing rather than leaving a dead
    // button — assert that, then satisfy it.
    await expect(page.getByText(/Still needed:/)).toContainText(/Header that carries the key/)
    await page.getByPlaceholder('e.g. X-API-Key').fill('X-Api-Key')
    await expect(page.getByText(/Still needed:/)).toHaveCount(0)

    await page.getByRole('button', { name: /^Create connector$/ }).click()

    // The whole point: the action confirms itself. Before this existed, the
    // panel simply closed and the user was left inferring.
    const status = page.getByRole('status')
    await expect(status).toContainText(/Connector saved/i, { timeout: 20_000 })
    // And it says what it affected, not just "Success".
    await expect(status).toContainText(NAME)

    await expect(page.getByRole('button', { name: `Delete connector ${NAME}` })).toBeVisible({
      timeout: 20_000,
    })

    // Deleting used to fire on the first click, unlike every other delete here.
    await page.getByRole('button', { name: `Delete connector ${NAME}` }).click()
    const dialogText = page.getByText(/This cannot be undone/i)
    await expect(dialogText).toBeVisible()
    await expect(page.getByText(/No agent is using it/i)).toBeVisible()

    await page.getByRole('button', { name: /^Delete connector$/ }).click()

    await expect(page.getByRole('status')).toContainText(/Connector deleted/i, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: `Delete connector ${NAME}` })).toHaveCount(0, {
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
