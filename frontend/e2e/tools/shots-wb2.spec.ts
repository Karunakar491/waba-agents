import { test } from '../fixtures/auth'

test('@shotswb2 the connectors screen is the workbench', async ({ authedPage: page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/library/connectors', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'e2e-shots/wb-list.png' })

  // Open the first library connector to see publish + delete in place.
  const first = page.locator('div.flex.h-full.w-72 button').filter({ hasText: /IndiaMART|Google|Test/ }).first()
  if ((await first.count()) > 0) {
    await first.click()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: 'e2e-shots/wb-live-connector.png' })
  }
  console.log('SHOTS done', page.url())
})
