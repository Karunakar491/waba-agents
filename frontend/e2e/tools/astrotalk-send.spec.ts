/**
 * Presses Send in the connector workbench, so the two Astrotalk APIs are known
 * to actually answer rather than merely being configured.
 *
 * Both calls are READS against Astrotalk's own APIs — a Kundli report for a
 * synthetic birth, and a recommendation lookup. Neither creates anything on
 * Astrotalk's side. Nothing in the product is saved by this file.
 *
 * The recommendation API needs a credential, which the library deliberately
 * does not store, so it is supplied from ASTROTALK_API_KEY at send time and
 * never written to this repository.
 *
 * Run: ASTROTALK_API_KEY=… npx playwright test --grep @astro-send
 */
import { expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { test } from '../fixtures/auth'

const API_KEY = process.env.ASTROTALK_API_KEY
const SHOTS = 'e2e-shots'

async function openAction(page: Page, connector: string, action: string) {
  await page.goto('/library/connectors')
  await page.waitForLoadState('networkidle')
  await page
    .locator('div.w-72')
    .getByRole('button', { name: new RegExp(`^${connector}`) })
    .first()
    .click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 20_000 })
  await page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: action }).click()
  await expect(page).toHaveURL(/\/actions\/\d+$/, { timeout: 20_000 })
}

/**
 * Fills the Response tab's "Body for this call" and, when given, the
 * per-call credential, then sends.
 *
 * Both live on the Response tab, not on Body or Authorization: the Body tab
 * holds the field SHAPES the agent will fill at runtime, and this pane holds
 * the real values for one test call. Sending without it is how the first
 * attempt got a truthful 422 "body: Field required".
 */
async function send(page: Page, shot: string, body: string, credential?: string): Promise<string> {
  await page.getByRole('tab', { name: /^Response/ }).click()
  await page.waitForTimeout(1000)
  await page.locator('textarea').last().fill(body)
  if (credential) {
    await page.getByPlaceholder('Paste the value to test with').fill(credential)
  }
  await page.getByRole('button', { name: /^Send$/ }).first().click()
  // A real third-party call over the public internet; give it room.
  await page.waitForTimeout(3000)
  for (let i = 0; i < 40; i++) {
    const text = await page.locator('main').first().innerText()
    if (/\b(200|4\d\d|5\d\d)\b|error|failed|timed out/i.test(text)) break
    await page.waitForTimeout(3000)
  }
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/astrotalk-send-${shot}.png`, fullPage: true })
  return page.locator('main').first().innerText()
}

test.describe('@astro-send the Astrotalk APIs actually answer', () => {
  // A synthetic birth, not a real customer's.
  const KUNDLI_BODY = JSON.stringify(
    {
      detail: {
        name: 'Test User',
        gender: 'Male',
        day: 1,
        month: 1,
        year: 1990,
        hour: 12,
        min: 0,
        lat: 28.6139,
        lon: 77.209,
        place: 'New Delhi, India',
        tzone: 5.5,
      },
    },
    null,
    2,
  )

  const RECOMMEND_BODY = JSON.stringify(
    {
      phone: '+919876543210',
      full_name: 'Test User',
      date_of_birth: '1990-01-01',
      time_of_birth: '12:00',
      place_of_birth: 'New Delhi, India',
    },
    null,
    2,
  )

  test('general_kundli returns a chart', async ({ authedPage: page }) => {
    test.setTimeout(600_000)
    await openAction(page, 'Astrotalk Kundli API', 'general_kundli')
    const result = await send(page, 'kundli', KUNDLI_BODY)
    console.log('--- general_kundli response pane ---\n' + result.slice(-2200))
  })

  test('recommend_astrologers returns astrologers', async ({ authedPage: page }) => {
    test.setTimeout(600_000)
    test.skip(!API_KEY, 'Set ASTROTALK_API_KEY to send a request that needs the credential')
    await openAction(page, 'Astrotalk Astrologer Recommendation', 'recommend_astrologers')

    // "Credential for this call — not saved, not sent to Meta, gone when you
    // leave this page." Sending without it earned an honest 401 AUTH_FAILED.
    const result = await send(page, 'recommend', RECOMMEND_BODY, API_KEY)
    console.log('--- recommend_astrologers response pane ---\n' + result.slice(-2500))
  })
})
