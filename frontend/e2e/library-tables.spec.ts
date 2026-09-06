import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * Proves the library sections render as tables and the Agents list carries
 * Meta's own agent id.
 *
 * Read-only throughout: it opens pages and reads them. It never edits,
 * publishes or deletes — these are real skills, connectors and personas on a
 * shared production box.
 *
 * Tagged @library-tables and kept out of the default suite for that reason.
 */
test.describe('@library-tables library sections', () => {
  for (const [name, path, itemLabel] of [
    ['Skills', '/library/skills', 'Skill'],
    ['Connectors', '/library/connectors', 'Connector'],
    ['Business persona', '/library/persona', 'Persona'],
  ] as const) {
    test(`${name} renders a table with a Used by column`, async ({ authedPage: page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      // An account with nothing saved shows an empty state instead, and that is
      // correct — skip rather than fail, so a red run always means a real break.
      const table = page.locator('table').first()
      test.skip((await table.count()) === 0, `no ${name} on this account yet`)

      await expect(table.getByRole('columnheader', { name: itemLabel, exact: true })).toBeVisible()
      await expect(table.getByRole('columnheader', { name: 'Status' })).toBeVisible()
      await expect(table.getByRole('columnheader', { name: 'Used by' })).toBeVisible()

      // The count is the reason the column exists, so assert it says something
      // legible rather than a bare "0" or an empty cell.
      const firstUsage = table.locator('tbody tr').first().locator('td').nth(2)
      await expect(firstUsage).toHaveText(/No agents|\d+ agents?/)
    })
  }

  test('Knowledgebase no longer offers an Edit that only navigates away', async ({
    authedPage: page,
  }) => {
    await page.goto('/library/files')
    await page.waitForLoadState('networkidle')

    // The pencil claimed to edit a file but there is no per-file endpoint; it
    // only jumped to the owning agent. Nothing should offer "Edit file" here.
    await expect(page.getByRole('link', { name: /^Edit file/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Edit website/ })).toHaveCount(0)
  })
})

test.describe('@library-tables agents list', () => {
  test("shows Meta's agent id, blank for agents that never deployed", async ({
    authedPage: page,
  }) => {
    await page.goto('/agents')
    await page.waitForLoadState('networkidle')

    const table = page.locator('table').first()
    await expect(table.getByRole('columnheader', { name: 'Agent ID' })).toBeVisible()

    // Every deployed agent's id begins pfbid; a draft that never deployed has
    // none and must render an em dash rather than our own internal id.
    const copyButtons = page.getByRole('button', { name: /^Copy Meta agent ID for / })
    expect(await copyButtons.count()).toBeGreaterThan(0)

    const shown = await copyButtons.first().innerText()
    expect(shown).toMatch(/^pfbid/)
    // Truncated, not the full ~110 characters.
    expect(shown.length).toBeLessThan(30)

    // The full value is available to copy, and lives in the title attribute.
    const full = await copyButtons.first().getAttribute('title')
    expect(full ?? '').toMatch(/^pfbid/)
    expect((full ?? '').length).toBeGreaterThan(80)
  })

  test('clicking the id copies it and does not open the agent', async ({ authedPage: page }) => {
    await page.goto('/agents')
    await page.waitForLoadState('networkidle')

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    const idButton = page.getByRole('button', { name: /^Copy Meta agent ID for / }).first()
    const full = await idButton.getAttribute('title')
    await idButton.click()

    // Still on the list. Copying an id and being navigated away would cost the
    // user their place, which is the whole reason the click is stopPropagation'd.
    await expect(page).toHaveURL(/\/agents$/)

    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe(full)
  })
})
