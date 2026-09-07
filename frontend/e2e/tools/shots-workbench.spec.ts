import { expect } from '@playwright/test'
import { test } from '../fixtures/auth'

test('@shotswb capture the connector workbench', async ({ authedPage: page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/library/connectors', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const edit = page.locator('a[href^="/library/connectors/"]').first()
  await edit.click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+/)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'e2e-shots/wb-connector.png' })
  console.log('SHOT wb-connector', page.url())

  // Open an action if the tree has one.
  const action = page.locator('button:has(span.font-mono)').filter({ hasText: /_|-/ }).first()
  if ((await action.count()) > 0) {
    await action.click()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: 'e2e-shots/wb-action.png' })
    console.log('SHOT wb-action', page.url())
  } else {
    console.log('NO ACTION IN TREE')
  }
})
