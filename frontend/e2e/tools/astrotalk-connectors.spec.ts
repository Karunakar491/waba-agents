/**
 * MUTATING. Creates the two Astrotalk connectors in the library, through the
 * product's own UI, from docs/jobs/astrotalk-agent-2026-09-15.json.
 *
 * Library-only: it creates connectors and their actions and saves the auth
 * HEADER NAME. It does not press Publish, so no credential value is typed and
 * nothing reaches Meta, an agent, or a phone number from this file.
 *
 * Resumable by design — it writes one thing at a time against a live account,
 * so a failure halfway leaves real work done and the fix has to be "run it
 * again". Every step checks before acting.
 *
 * Run: npx playwright test --grep @astro-connectors
 */
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { test } from '../fixtures/auth'
import { SAVE_ACTION, addAction, chooseProperty, setProperty } from '../fixtures/connectors'

const JOB = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-agent-2026-09-15.json', 'utf8'),
) as {
  connectors: {
    name: string
    description: string
    baseUrl: string
    tags: string
    auth: { type: string; headers: string[] } | null
    actions: { name: string; description: string; curl: string }[]
  }[]
}

/** The library's own list, in the left panel. */
function tree(page: Page) {
  return page.locator('div.w-72')
}

/** Opens a connector by name if it is already there; returns false if it is not. */
async function openIfPresent(page: Page, name: string): Promise<boolean> {
  await page.goto('/library/connectors')
  await page.waitForLoadState('networkidle')
  const row = tree(page).getByRole('button', { name, exact: true }).first()
  if ((await row.count()) === 0) return false
  await row.click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 20_000 })
  return true
}

test.describe('@astro-connectors Astrotalk connectors', () => {
  for (const connector of JOB.connectors) {
    test(`${connector.name}`, async ({ authedPage: page }) => {
      test.setTimeout(600_000)

      // ---- the connector itself ------------------------------------------
      if (!(await openIfPresent(page, connector.name))) {
        await tree(page).getByRole('button', { name: 'New connector' }).click()
        await expect(page).toHaveURL(/\/library\/connectors\/new$/)
        await setProperty(page, 'Name', connector.name)
        await setProperty(page, 'Description', connector.description)
        await setProperty(page, 'Base URL', connector.baseUrl)
        await page.getByRole('button', { name: /^Create connector$/ }).click()
        await expect(page.getByRole('status')).toContainText(/Connector saved/i, {
          timeout: 30_000,
        })
        await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 30_000 })
      }
      const connectorUrl = page.url()
      console.log(`${connector.name} → ${connectorUrl}`)

      // ---- its actions ----------------------------------------------------
      for (const action of connector.actions) {
        await page.goto(connectorUrl)
        await page.waitForLoadState('networkidle')
        const actions = page.getByRole('region', { name: 'Actions' })
        if (await actions.getByRole('button', { name: action.name }).count()) {
          console.log(`  action ${action.name} already exists — left alone`)
          continue
        }

        await addAction(page)
        await page.getByPlaceholder('e.g. product_search').fill(action.name)

        // The cURL box fills method, path, query, headers and body in one go —
        // the same paste a person would do, rather than typing six tabs by hand.
        await page.getByRole('button', { name: /Import a cURL command/i }).click()
        const box = page.getByRole('region', { name: 'Import a cURL command' })
        await box.getByRole('textbox').fill(action.curl)
        await box.getByRole('button', { name: /^Check it$/ }).click()
        await box
          .getByRole('button', { name: /^(Import|Import anyway)$/ })
          .first()
          .click()
        await expect(page.locator('#wb-method')).toHaveValue('POST', { timeout: 20_000 })

        // The description is what the model reads to decide when to call this,
        // so it is the most load-bearing field on the screen. It lives on Docs.
        await page.getByRole('tab', { name: 'Docs' }).click()
        await page.getByPlaceholder(/Search the catalogue/i).fill(action.description)

        await page.getByRole('button', { name: SAVE_ACTION }).click()
        await expect(page.getByRole('status')).toContainText(/Action (added|saved)/i, {
          timeout: 30_000,
        })
        await expect(page).toHaveURL(/\/actions\/\d+$/, { timeout: 30_000 })
        console.log(`  action ${action.name} → ${page.url()}`)

        // ---- auth, which is the connector's and lives on the action --------
        if (connector.auth) {
          await page.getByRole('tab', { name: 'Authorization' }).click()
          await chooseProperty(page, 'Auth', connector.auth.type)
          for (const [i, header] of connector.auth.headers.entries()) {
            if (i > 0) await page.getByRole('button', { name: /Add another header/i }).click()
            await page.getByLabel(`Credential field ${i + 1}`).fill(header)
          }
          await page.getByRole('button', { name: /^Save connector$/ }).click()
          await expect(page.getByRole('status')).toContainText(/Saved/i, { timeout: 30_000 })
        }
      }

      // ---- what the library now holds, read back --------------------------
      await page.goto(connectorUrl)
      await page.waitForLoadState('networkidle')
      const text = (await page.locator('main').first().innerText()).replace(/\n{3,}/g, '\n\n')
      console.log(`--- ${connector.name} after ---\n${text.slice(0, 1800)}`)
      for (const action of connector.actions) {
        await expect(
          page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: action.name }),
        ).toBeVisible({ timeout: 20_000 })
      }
    })
  }
})
