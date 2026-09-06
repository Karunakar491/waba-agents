import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * Proves the connector edit page reached production and works.
 *
 * Read-only: it opens a connector and reads what is on screen. It does not
 * create, edit or delete an action, because these are real connectors on a
 * shared production box.
 *
 * Tagged @connector-edit and excluded from the default suite, like the other
 * journeys that touch live library data.
 */
test.describe('@connector-edit connector edit page', () => {
  test('Edit opens the connector on its own page, with its actions', async ({ authedPage: page }) => {
    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')

    const editLink = page.locator('a[href^="/library/connectors/"]').first()
    const anyConnector = await editLink.count()
    test.skip(anyConnector === 0, 'no connectors on this account to open')

    await editLink.click()

    // The point of the whole change: a URL of its own, not an inline panel and
    // not a detour through an agent.
    await expect(page).toHaveURL(/\/library\/connectors\/\d+/)

    await expect(page.getByRole('link', { name: /Back to Connectors/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Where it is/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /What it can do/i })).toBeVisible()

    // Either it has actions, or it says plainly that it cannot do anything —
    // never a silently empty section that reads as "configured".
    await page.waitForLoadState('networkidle')
    const emptyState = page.getByText(/can't do anything yet/i)
    const addButton = page.getByRole('button', { name: /Add an action/i })
    await expect(addButton).toBeVisible()

    const actionRows = page.locator('li:has(button[aria-label^="Edit action"])')
    const hasActions = (await actionRows.count()) > 0
    if (!hasActions) await expect(emptyState).toBeVisible()
  })

  test('the action editor opens with its four fields and Advanced stays shut', async ({
    authedPage: page,
  }) => {
    await page.goto('/library/connectors')
    await page.waitForLoadState('networkidle')

    const editLink = page.locator('a[href^="/library/connectors/"]').first()
    test.skip((await editLink.count()) === 0, 'no connectors on this account to open')
    await editLink.click()
    await expect(page).toHaveURL(/\/library\/connectors\/\d+/)

    await page.getByRole('button', { name: /Add an action/i }).click()

    await expect(page.locator('#action-name')).toBeVisible()
    await expect(page.locator('#action-description')).toBeVisible()
    await expect(page.locator('#action-method')).toBeVisible()
    await expect(page.locator('#action-path')).toBeVisible()

    // Headers must NOT be on screen until Advanced is opened — that collapse is
    // the whole reason the page is usable rather than a wall of panels.
    await expect(page.getByText(/^Headers$/)).toBeHidden()
    await page.getByRole('button', { name: /^Advanced$/ }).click()
    await expect(page.getByText(/^Headers$/)).toBeVisible()

    // Nothing is saved: leave without submitting.
    await page.getByRole('button', { name: /^Cancel$/ }).click()
    await expect(page.locator('#action-name')).toBeHidden()
  })
})
