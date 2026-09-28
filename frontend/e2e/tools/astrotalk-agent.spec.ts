/**
 * MUTATING. Configures the draft Astrotalk agent through the product's own UI,
 * from docs/jobs/astrotalk-agent-2026-09-15.json.
 *
 * Three independent steps, each tagged so it can be run alone:
 *   @astro-persona  a persona DRAFT (saved, not deployed — deploying replaces
 *                   what is live on Meta, which is the founder's call)
 *   @astro-skills   the conversational skills. Publish skill writes to Meta.
 *   @astro-faqs     the knowledge-base FAQs
 *
 * It never presses "Publish & Test" — that puts the agent live on
 * +91 96422 01123 and starts it answering real customers.
 *
 * Every step checks before acting, so a failure halfway through can be fixed by
 * running it again rather than by undoing.
 *
 * Run: npx playwright test --grep "@astro-persona|@astro-skills|@astro-faqs"
 */
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { test } from '../fixtures/auth'

const JOB = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-agent-2026-09-15.json', 'utf8'),
) as {
  agentId: string
  persona: Record<string, string>
  skills: { title: string; description: string; body: string }[]
  faqs: { question: string; answer: string }[]
}

const AGENT = `/agents/${JOB.agentId}`

async function openTab(page: Page, tab: string) {
  await page.goto(AGENT)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: tab }).first().click()
  await page.waitForTimeout(1500)
}

test.describe('Astrotalk agent configuration', () => {
  test('business persona draft @astro-persona', async ({ authedPage: page }) => {
    test.setTimeout(600_000)
    await openTab(page, 'Business Persona')

    // Edit the existing draft rather than stacking a new one — the draft on
    // this agent is the wrong company's, so it is a correction, not an addition.
    await page.getByRole('button', { name: /^Edit$/ }).first().click()
    await page.waitForTimeout(2000)

    /*
     * The eight fields are in a fixed documented order and carry no label a
     * locator can address (see persona.formNote in the job file), so they are
     * filled by position. The guard is the first field's current value: if it
     * no longer holds the SMSA Express text, the form is not what this script
     * was written against and it stops rather than typing into the wrong box.
     */
    const textareas = page.locator('textarea')
    const inputs = page.locator('input[type="text"]')
    const first = textareas.first()
    const current = await first.inputValue()
    expect(
      /SMSA|Astrotalk/i.test(current),
      `first persona field should hold the business description (found: "${current.slice(0, 120)}")`,
    ).toBe(true)

    await first.fill(JOB.persona.body)
    await inputs.nth(0).fill(JOB.persona.acceptedPaymentMethods)
    await textareas.nth(1).fill(JOB.persona.returnPolicy)
    await textareas.nth(2).fill(JOB.persona.howToMakeAPurchase)
    await textareas.nth(3).fill(JOB.persona.deliveryAndShipping)
    // Contact email (inputs 1) and Address (inputs 3) are left alone on
    // purpose — a made-up support address is worse than an empty one.
    await inputs.nth(2).fill(JOB.persona.hoursOfOperation)

    // Save draft fires no toast, so the saved draft itself is the confirmation —
    // asserting on a status that never appears just fails a save that worked.
    await page.getByRole('button', { name: /^Save draft$/ }).click()
    await expect(page.getByRole('button', { name: /^Edit$/ }).first()).toBeVisible({
      timeout: 30_000,
    })

    // Read it back: the draft on screen should now be Astrotalk, not a courier.
    await openTab(page, 'Business Persona')
    const shown = await page.locator('main').first().innerText()
    expect(shown).toContain('Astrotalk')
    console.log('persona draft saved. NOT deployed — Meta still has the old version.')
  })

  test('conversational skills @astro-skills', async ({ authedPage: page }) => {
    test.setTimeout(1_800_000)

    for (const skill of JOB.skills) {
      await openTab(page, 'Skills')

      // Already published from an earlier run? Leave it. Editing a published
      // skill is a different operation and this script does not do it silently.
      const existing = page
        .getByRole('list', { name: 'Published skills' })
        .getByRole('listitem')
        .filter({ has: page.getByText(skill.title, { exact: true }) })
      if (await existing.count()) {
        console.log(`skill ${skill.title} already published — left alone`)
        continue
      }

      await page.getByRole('button', { name: /^Add skill$/ }).first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 20_000 })
      await dialog.getByPlaceholder('e.g. handoff-guardrails').fill(skill.title)
      await dialog.getByPlaceholder(/Tell the agent WHEN to apply this skill/).fill(skill.description)
      await dialog
        .getByPlaceholder('The actual instructions the agent follows for this skill.')
        .fill(skill.body)
      await dialog.getByRole('button', { name: /^Publish skill$/ }).click()

      // Publishing writes to Meta, one call per skill, and is slow.
      await expect(dialog).toBeHidden({ timeout: 120_000 })
      await openTab(page, 'Skills')
      await expect(
        page
          .getByRole('list', { name: 'Published skills' })
          .getByRole('listitem')
          .filter({ has: page.getByText(skill.title, { exact: true }) }),
      ).toHaveCount(1, { timeout: 60_000 })
      console.log(`skill ${skill.title} published`)
    }
  })

  /*
   * Adding a FAQ is eventually consistent: the row can take well over 30
   * seconds to appear, so the first version of this step timed out on a FAQ
   * that had in fact been created. It also caught the app duplicating an
   * earlier FAQ on a later Add, so the count is checked as well as the text —
   * a step that silently doubles a customer-facing answer is worse than one
   * that stops.
   */
  test('knowledge-base FAQs @astro-faqs', async ({ authedPage: page }) => {
    test.setTimeout(1_800_000)

    /** One per FAQ row. */
    const rows = (p: Page) => p.getByRole('button', { name: 'Unpublish' })

    for (const faq of JOB.faqs) {
      await openTab(page, 'Knowledge Base')
      if ((await page.locator('main').first().innerText()).includes(faq.question)) {
        console.log(`faq "${faq.question}" already there — left alone`)
        continue
      }
      const before = await rows(page).count()

      await page.getByRole('button', { name: /^Add FAQ$/ }).first().click()
      await expect(page.getByPlaceholder('Question')).toBeVisible({ timeout: 20_000 })
      await page.getByPlaceholder('Question').fill(faq.question)
      await page.getByPlaceholder('Answer').fill(faq.answer)
      await page.getByRole('button', { name: /^Add$/ }).first().click()

      // Wait for the row to actually exist, reloading rather than trusting the
      // optimistic list.
      let landed = false
      for (let i = 0; i < 12 && !landed; i++) {
        await page.waitForTimeout(5000)
        await openTab(page, 'Knowledge Base')
        landed = (await page.locator('main').first().innerText()).includes(faq.question)
      }
      const after = await rows(page).count()
      expect(landed, `FAQ never appeared: ${faq.question}`).toBe(true)
      expect(
        after,
        `adding "${faq.question}" changed the FAQ count by ${after - before}, not 1 — the app has duplicated a row`,
      ).toBe(before + 1)
      console.log(`faq added (${after} total): ${faq.question}`)
    }
  })

  /*
   * Removes the duplicate "Kitna charge lagta hai?" row the app created on
   * 2026-09-15 while the FAQs were being added. Deliberately narrow: it acts
   * only if that exact question appears exactly twice, and it unpublishes the
   * SECOND one. A customer seeing the same answer twice is a visible defect;
   * a script that guesses which row to remove is a worse one.
   */
  test('remove the duplicated FAQ row @astro-faq-dupe', async ({ authedPage: page }) => {
    test.setTimeout(600_000)
    const DUPE = 'Kitna charge lagta hai?'

    await openTab(page, 'Knowledge Base')
    const matches = page.getByText(DUPE, { exact: true })
    const n = await matches.count()
    if (n < 2) {
      console.log(`"${DUPE}" appears ${n} time(s) — nothing to remove`)
      return
    }
    expect(n, 'expected exactly two copies; more than that needs a human to look').toBe(2)

    const before = await page.getByRole('button', { name: 'Unpublish' }).count()
    // The second copy's own row, reached from the duplicated text itself, so
    // this can never unpublish a different FAQ.
    await matches
      .nth(1)
      .locator('xpath=ancestor::*[.//button[normalize-space()="Unpublish"]][1]')
      .getByRole('button', { name: 'Unpublish' })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    if (await dialog.count()) {
      await dialog.getByRole('button', { name: /Unpublish|Confirm|Remove/i }).first().click()
    }

    let gone = false
    for (let i = 0; i < 12 && !gone; i++) {
      await page.waitForTimeout(5000)
      await openTab(page, 'Knowledge Base')
      gone = (await page.getByText(DUPE, { exact: true }).count()) === 1
    }
    expect(gone, 'the duplicate should be gone and the original still there').toBe(true)
    const after = await page.getByRole('button', { name: 'Unpublish' }).count()
    console.log(`duplicate removed: ${before} FAQ rows → ${after}`)
  })
})
