/**
 * MUTATING, and it reaches Meta. Publishes the two Astrotalk connectors onto
 * the Astrotalk agent, which creates them on the agent's phone number at Meta.
 *
 * It does NOT press "Publish & Test" on the agent — the agent stays a draft and
 * answers nobody. What this adds is the capability; going live is separate.
 *
 * The credential is read from ASTROTALK_API_KEY in the environment and is
 * never written to this repository. The product does not store it either — the
 * dialog says so: it is forwarded to Meta with the publish call.
 *
 * Run: ASTROTALK_API_KEY=… npx playwright test --grep @astro-publish
 */
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { test } from '../fixtures/auth'

const JOB = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-agent-2026-09-15.json', 'utf8'),
) as {
  agentName: string
  connectors: { name: string; auth: { type: string; headers: string[] } | null }[]
}

const API_KEY = process.env.ASTROTALK_API_KEY

/** Opens a connector from the library's left panel by the start of its name. */
async function openConnector(page: Page, name: string) {
  await page.goto('/library/connectors')
  await page.waitForLoadState('networkidle')
  // Not an exact match: the row's accessible name also carries its action count
  // and its Draft badge.
  await page
    .locator('div.w-72')
    .getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    .first()
    .click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 20_000 })
}

test.describe('@astro-publish publish Astrotalk connectors to the agent', () => {
  for (const connector of JOB.connectors) {
    test(`${connector.name}`, async ({ authedPage: page }) => {
      test.setTimeout(600_000)
      test.skip(
        Boolean(connector.auth) && !API_KEY,
        'Set ASTROTALK_API_KEY to publish the connector that needs a credential',
      )

      await openConnector(page, connector.name)

      // Already on the agent? The page says so, and publishing twice would
      // write to Meta again for no reason.
      const pane = await page.locator('main').first().innerText()
      if (pane.includes(JOB.agentName) && !/Not on any agent/.test(pane)) {
        console.log(`${connector.name} is already on ${JOB.agentName} — left alone`)
        return
      }

      await page.getByRole('button', { name: /^Publish$/ }).first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 20_000 })

      await dialog.locator('select').first().selectOption({ label: JOB.agentName })
      if (connector.auth) {
        for (const header of connector.auth.headers) {
          await expect(dialog.getByText(new RegExp(`Value for ${header}`, 'i'))).toBeVisible()
        }
        await dialog.locator('input[type="password"]').first().fill(API_KEY!)
      }

      await dialog.getByRole('button', { name: /^Publish to this agent$/ }).click()
      await expect(dialog).toBeHidden({ timeout: 180_000 })

      // Read it back on the connector, then on the agent — the agent's own
      // Connectors tab is what the agent will actually use.
      await openConnector(page, connector.name)
      await expect(page.locator('main').first()).toContainText(JOB.agentName, { timeout: 60_000 })
      console.log(`${connector.name} published to ${JOB.agentName}`)
    })
  }
})
