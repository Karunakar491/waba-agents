import { test, expect } from './fixtures/auth'

/**
 * Read-only checks on the four features deployed 2026-09-03.
 *
 * STRICTLY read-only: navigate, open, read. No create, edit, delete or save.
 * This runs against production, so a test that mutates would be changing real
 * customer-facing data to prove a button exists.
 *
 * Where the account has no data to look at, the test skips with a reason
 * rather than failing — "no agents exist" is not a broken feature.
 */

test.describe('deployed 2026-09-03', () => {
  test('Agents list renders', async ({ authedPage: page }) => {
    await page.goto('/agents')
    await expect(page.getByRole('table').or(page.getByText(/no agents/i))).toBeVisible()
  })

  test('Webhooks panel loads with working filters', async ({ authedPage: page }) => {
    await page.goto('/debug')
    // The rewritten panel's distinguishing feature is real filter inputs.
    const filters = page.locator('input, select')
    await expect(filters.first()).toBeVisible()
    expect(await filters.count()).toBeGreaterThan(1)
  })

  test('Skill edit opens as a full page, not a dialog', async ({ authedPage: page }) => {
    await page.goto('/library/skills')
    await page.waitForLoadState('networkidle')

    const editable = page.getByRole('button', { name: /edit/i }).first()
    if (!(await editable.isVisible().catch(() => false))) {
      test.skip(true, 'no skills in this account to open')
    }
    await editable.click()

    // The whole point of the change: a route, not a modal.
    await expect(page).toHaveURL(/\/library\/skills\/[^/]+\/edit/, { timeout: 15_000 })
    await expect(page.locator('textarea')).toBeVisible()
  })

  test('Inbox renders threads', async ({ authedPage: page }) => {
    await page.goto('/inbox')
    await page.waitForLoadState('networkidle')
    // Either conversations or an explicit empty state — a blank panel is the bug.
    await expect(
      page.getByRole('list').or(page.getByText(/no conversation|no messages|select a/i)).first()
    ).toBeVisible()
  })

  test('no server errors while touring the deployed screens', async ({ authedPage: page }) => {
    const failures: string[] = []
    page.on('response', (r) => {
      if (r.status() >= 500) failures.push(`${r.status()} ${r.url()}`)
    })

    for (const route of ['/agents', '/inbox', '/library/skills', '/debug', '/templates']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
    }

    expect(failures, `5xx responses:\n${failures.join('\n')}`).toEqual([])
  })
})
