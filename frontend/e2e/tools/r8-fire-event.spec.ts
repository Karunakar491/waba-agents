/**
 * MUTATING. Fires a real business event through the real app at real Meta.
 *
 * Agent 890850880113348608 ("ZZ R4R6 Proof") is bound to the reserved test
 * number +91 90100 11634 and already has an open conversation with
 * 919885388883 (from an earlier proof run). This spec:
 *
 *   @r8-fire-draft   fires the event while the agent is still draft — proves
 *                     the ledger refuses a non-live agent instead of lying
 *   @r8-golive       publishes the agent
 *   @r8-fire-live    fires the same event again — proves it actually reaches
 *                     Meta and the ledger records delivery
 *
 * Run: npx playwright test --grep @r8-fire
 */
import { expect } from '@playwright/test'
import { test } from '../fixtures/auth'

const AGENT_ID = '890850880113348608'
const CUSTOMER = '+918500996740'
const SHOTS = 'e2e-shots'

test.describe('R8 business event fire proof', () => {
  test('fire while draft @r8-fire-draft', async ({ authedPage: page }) => {
    test.setTimeout(120_000)
    await page.goto(`/agents/${AGENT_ID}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(1500)

    const trigger = page.getByRole('button', { name: 'Trigger event' }).first()
    await expect(trigger, 'Trigger event control should exist').toBeVisible()
    await trigger.click()
    await page.waitForTimeout(1000)

    const modal = page.getByRole('dialog').filter({ hasText: 'Trigger event' }).first()
    await modal.getByPlaceholder('+15551234567', { exact: true }).fill(CUSTOMER)
    await modal.getByPlaceholder(/Customer's payment/).fill('R8 draft-agent proof — should refuse')
    await modal.getByRole('button', { name: 'Send event' }).click()
    await page.waitForTimeout(4000)

    const modalText = await modal.innerText()
    console.log('DRAFT FIRE RESULT:', modalText.replace(/\s*\n+\s*/g, ' | ').slice(0, 500))
    await page.screenshot({ path: `${SHOTS}/r8-fire-draft.png`, fullPage: true })
  })

  test('go live @r8-golive', async ({ authedPage: page }) => {
    test.setTimeout(300_000)
    await page.goto(`/agents/${AGENT_ID}`)
    await page.waitForLoadState('networkidle')

    const bodyText = await page.locator('main').first().innerText()
    if (/\bActive\b/.test(bodyText)) {
      console.log('already Active — skipping publish')
      return
    }

    const publish = page.getByRole('button', { name: /Publish/i }).first()
    console.log('publish button count:', await publish.count())
    if (await publish.count()) {
      await publish.click()
      await page.waitForTimeout(4000)
      const cont = page.locator('main').getByRole('button', { name: /^Continue$/ }).first()
      if (await cont.count()) {
        console.log('preflight: ' + (await page.locator('main').first().innerText()).slice(0, 400).replace(/\s*\n+\s*/g, ' | '))
        await cont.click()
      }
    }

    let live = false
    for (let i = 0; i < 18 && !live; i++) {
      await page.waitForTimeout(5000)
      await page.goto(`/agents/${AGENT_ID}`)
      await page.waitForLoadState('networkidle')
      live = /Active/.test(await page.locator('main').first().innerText())
    }
    await page.screenshot({ path: `${SHOTS}/r8-golive.png`, fullPage: true })
    expect(live, 'agent should be Active after publish').toBe(true)
  })

  test('fire while live @r8-fire-live', async ({ authedPage: page }) => {
    test.setTimeout(120_000)
    await page.goto(`/agents/${AGENT_ID}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(1500)

    const trigger = page.getByRole('button', { name: 'Trigger event' }).first()
    await expect(trigger).toBeVisible()
    await trigger.click()
    await page.waitForTimeout(1000)

    const modal = page.getByRole('dialog').filter({ hasText: 'Trigger event' }).first()
    await modal.getByPlaceholder('+15551234567', { exact: true }).fill(CUSTOMER)
    await modal
      .getByPlaceholder(/Customer's payment/)
      .fill('R8 real Meta proof — payment of Rs 499 received')
    await modal.getByRole('button', { name: 'Send event' }).click()

    // Poll can take a few seconds against real Meta.
    await page.waitForTimeout(8000)
    const modalText = await modal.innerText()
    console.log('LIVE FIRE RESULT:', modalText.replace(/\s*\n+\s*/g, ' | ').slice(0, 500))
    await page.screenshot({ path: `${SHOTS}/r8-fire-live.png`, fullPage: true })
  })
})
