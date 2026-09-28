/**
 * MUTATING, AND IT GOES LIVE TO REAL CUSTOMERS.
 *
 * Authorised by the founder 2026-09-15 ("take it live"), after the agent was
 * built and read back — see wiki/sessions/astrotalk-agent-build-2026-09-15.md.
 *
 * Two steps, in this order and for a reason:
 *   1. Deploy the Astrotalk persona, so Meta stops holding the previous one.
 *      Going live first would answer customers with the wrong persona.
 *   2. Publish & Test, which starts the agent answering on +91 96422 01123.
 *
 * It reads back what each step produced rather than trusting a button click,
 * and it says what any dialog asked before it answered.
 *
 * Run: npx playwright test --grep @astro-golive
 */
import { expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { test } from '../fixtures/auth'

const JOB = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-agent-2026-09-15.json', 'utf8'),
) as { agentId: string; agentName: string }

const AGENT = `/agents/${JOB.agentId}`
const SHOTS = 'e2e-shots'

async function tab(page: Page, name: string) {
  await page.goto(AGENT)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name }).first().click()
  await page.waitForTimeout(2000)
  return page.locator('main').first()
}

/**
 * Answers a confirmation if one appears, after saying what it asked.
 *
 * Publish & Test does NOT use a dialog: its preflight warning renders inline in
 * the header, with Cancel and Continue beside it. Looking only for
 * role="dialog" reported "no dialog", left the warning unanswered, and the next
 * navigation quietly cancelled the publish — so this checks both.
 */
async function confirmIfAsked(page: Page, confirm: RegExp): Promise<string> {
  const dialog = page.getByRole('dialog')
  const scope = (await dialog.count()) ? dialog.first() : page.locator('main').first()
  const button = scope.getByRole('button', { name: confirm }).first()
  if (!(await button.count())) return 'nothing to confirm'
  const asked = (await scope.innerText()).replace(/\n{2,}/g, ' · ').slice(0, 400)
  await button.click()
  return asked
}

test.describe('@astro-golive take Astrotalk live', () => {
  test('deploy the persona', async ({ authedPage: page }) => {
    test.setTimeout(900_000)
    mkdirSync(SHOTS, { recursive: true })

    const persona = await tab(page, 'Business Persona')
    const before = await persona.innerText()
    expect(before, 'the Astrotalk draft must be the thing being deployed').toContain(
      "Astrotalk is India's largest astrology",
    )

    await page.getByRole('button', { name: /^Deploy$/ }).first().click()
    console.log('deploy dialog said: ' + (await confirmIfAsked(page, /^(Deploy|Confirm|Yes)/i)))

    // Deploying writes to Meta. Wait for the Published block to carry the new
    // persona, not just for a button to stop spinning.
    let live = false
    for (let i = 0; i < 24 && !live; i++) {
      await page.waitForTimeout(5000)
      const text = await (await tab(page, 'Business Persona')).innerText()
      // Once deployed, the Astrotalk text is the published version and the
      // Drafts list no longer holds it.
      live = /Published/.test(text) && !/Drafts[\s\S]*Astrotalk is India's largest/.test(text)
    }
    const after = await (await tab(page, 'Business Persona')).innerText()
    await page.screenshot({ path: `${SHOTS}/astrotalk-golive-persona.png`, fullPage: true })
    console.log('--- persona tab after deploy ---\n' + after.slice(0, 1200))
    expect(live, 'the Astrotalk persona should be the published version now').toBe(true)
  })

  test('publish and test', async ({ authedPage: page }) => {
    test.setTimeout(900_000)

    // The first attempt clicked Publish & Test, got no dialog, and left the
    // agent a Draft — so this records what the click actually did: which
    // requests it made, which failed, and what the screen said afterwards.
    const calls: string[] = []
    page.on('response', (r) => {
      const url = r.url()
      if (!/\/api\//.test(url)) return
      if (r.status() >= 400 || /publish|deploy|agent/i.test(url)) {
        calls.push(`${r.status()} ${r.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`)
      }
    })

    await page.goto(AGENT)
    await page.waitForLoadState('networkidle')
    const button = page.getByRole('button', { name: /^Publish & Test$/ }).first()
    console.log(
      `Publish & Test: visible=${await button.isVisible()} enabled=${await button.isEnabled()}`,
    )
    calls.length = 0
    await button.click()
    await page.waitForTimeout(6000)
    await page.screenshot({ path: `${SHOTS}/astrotalk-golive-click.png`, fullPage: true })
    console.log('requests on click:\n' + (calls.join('\n') || '(none)'))
    const toast = await page.getByRole('status').innerText().catch(() => '')
    console.log('toast: ' + (toast.trim() || '(empty)'))
    console.log('screen right after click:\n' + (await page.locator('main').first().innerText()).slice(0, 900))

    // The preflight warning, answered. It lists what is already on the number —
    // which is this agent's own 7 skills and 2 connectors.
    console.log('preflight said: ' + (await confirmIfAsked(page, /^Continue$/)))
    await page.waitForTimeout(5000)
    console.log('requests after Continue:\n' + (calls.join('\n') || '(none)'))
    // A second confirmation, if publishing asks for one after the preflight.
    console.log(
      'publish confirm said: ' + (await confirmIfAsked(page, /^(Publish|Go live|Confirm|Yes)/i)),
    )

    // The badge next to the agent's name is the answer: Draft, or not.
    let published = false
    for (let i = 0; i < 24 && !published; i++) {
      await page.waitForTimeout(5000)
      await page.goto(AGENT)
      await page.waitForLoadState('networkidle')
      published = !/\bDraft\b/.test(await page.locator('main').first().innerText())
    }
    const final = await page.locator('main').first().innerText()
    await page.screenshot({ path: `${SHOTS}/astrotalk-golive-agent.png`, fullPage: true })
    console.log('--- agent header after publish ---\n' + final.slice(0, 900))

    // Read it back from the list too, which is where an operator would look.
    await page.goto('/agents')
    await page.waitForLoadState('networkidle')
    const row = page
      .getByRole('row')
      .filter({ has: page.getByText(JOB.agentName, { exact: true }) })
      .first()
    console.log('--- Agents list row ---\n' + (await row.innerText()).replace(/\n+/g, ' | '))
    await page.screenshot({ path: `${SHOTS}/astrotalk-golive-list.png`, fullPage: true })

    expect(published, 'the agent should no longer be a Draft').toBe(true)
  })
})
