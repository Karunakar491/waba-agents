import { test } from '../fixtures/auth'

/**
 * Screenshots of the library screens, so they can be looked at rather than
 * inferred from the DOM. Read-only.
 */
const SHOTS: [string, string][] = [
  ['/library/skills', 'skills'],
  ['/library/connectors', 'connectors'],
  ['/library/persona', 'persona'],
  ['/library/files', 'files'],
  ['/agents', 'agents'],
]

test('@shotslib capture the library screens', async ({ authedPage: page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1440, height: 900 })

  for (const [route, name] of SHOTS) {
    await page.goto(route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: `e2e-shots/${name}.png`, fullPage: false })
    console.log(`SHOT ${name} <- ${route}`)
  }
})
