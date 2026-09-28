/**
 * The pricing FAQ came back "Not synced" after the agent went live — the one
 * whose accidental duplicate was unpublished. It is the single most likely
 * customer question on a paid consultation product, so it should not be the one
 * answer Meta does not have.
 *
 * This reads what the row offers, tries the obvious repair, and reports. It
 * touches exactly that FAQ.
 *
 * Run: npx playwright test --grep @astro-faq-sync
 */
import { expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { test } from '../fixtures/auth'

const JOB = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-agent-2026-09-15.json', 'utf8'),
) as { agentId: string; faqs: { question: string; answer: string }[] }

const AGENT = `/agents/${JOB.agentId}`
const FAQ = JOB.faqs[0]

test('resync the pricing FAQ @astro-faq-sync', async ({ authedPage: page }) => {
  test.setTimeout(900_000)

  await page.goto(AGENT)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Knowledge Base' }).first().click()
  await page.waitForTimeout(2500)

  const row = page
    .getByText(FAQ.question, { exact: true })
    .locator('xpath=ancestor::*[.//button[normalize-space()="Unpublish"]][1]')
    .first()
  await expect(row).toBeVisible({ timeout: 20_000 })

  const text = await row.innerText()
  const buttons = await row.getByRole('button').allInnerTexts()
  console.log(`row says: ${text.replace(/\n+/g, ' | ')}`)
  console.log(`row offers: ${buttons.join(' | ')}`)

  if (!/Not synced/.test(text)) {
    console.log('already synced — nothing to do')
    return
  }

  /*
   * No sync button of its own, so the repair is the pair the UI does give:
   * unpublish the unsynced row and add the FAQ again, which publishes it to
   * Meta the same way the other five got there. Same question, same answer,
   * from the job file — so the customer-facing text cannot drift.
   */
  const resync = row.getByRole('button', { name: /Sync|Retry|Republish/i }).first()
  if (await resync.count()) {
    await resync.click()
    console.log('used the row\'s own sync control')
  } else {
    await row.getByRole('button', { name: 'Unpublish' }).click()
    const dialog = page.getByRole('dialog')
    if (await dialog.count()) {
      await dialog.getByRole('button', { name: /Unpublish|Confirm|Remove/i }).first().click()
    }
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(5000)
      await page.goto(AGENT)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Knowledge Base' }).first().click()
      await page.waitForTimeout(2000)
      if ((await page.getByText(FAQ.question, { exact: true }).count()) === 0) break
    }

    await page.getByRole('button', { name: /^Add FAQ$/ }).first().click()
    await expect(page.getByPlaceholder('Question')).toBeVisible({ timeout: 20_000 })
    await page.getByPlaceholder('Question').fill(FAQ.question)
    await page.getByPlaceholder('Answer').fill(FAQ.answer)
    await page.getByRole('button', { name: /^Add$/ }).first().click()
  }

  // FAQ writes are eventually consistent, so wait for the row rather than for a
  // spinner, and read whether Meta has it.
  let synced = false
  let last = ''
  for (let i = 0; i < 18 && !synced; i++) {
    await page.waitForTimeout(5000)
    await page.goto(AGENT)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Knowledge Base' }).first().click()
    await page.waitForTimeout(2000)
    const again = page
      .getByText(FAQ.question, { exact: true })
      .locator('xpath=ancestor::*[.//button[normalize-space()="Unpublish"]][1]')
      .first()
    if (!(await again.count())) continue
    last = await again.innerText()
    synced = !/Not synced/.test(last)
  }
  console.log(`final row: ${last.replace(/\n+/g, ' | ')}`)
  console.log(
    `FAQ count now: ${await page.getByRole('button', { name: 'Unpublish' }).count()} (expected 6)`,
  )
  expect(synced, 'the pricing FAQ should be synced to Meta').toBe(true)
})
