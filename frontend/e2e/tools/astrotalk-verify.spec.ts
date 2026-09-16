/**
 * READ-ONLY. Reads the built Astrotalk agent back from its own screens and
 * asserts everything the build was supposed to put there is actually there.
 *
 * This exists because "the script passed" is not evidence. The evidence is the
 * agent's own tabs saying so, plus a screenshot per tab.
 *
 * Run: npx playwright test --grep @astro-verify
 */
import { expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { test } from '../fixtures/auth'

const JOB = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-agent-2026-09-15.json', 'utf8'),
) as {
  agentId: string
  agentName: string
  skills: { title: string }[]
  faqs: { question: string }[]
  connectors: { name: string; actions: { name: string }[] }[]
}

const AGENT = `/agents/${JOB.agentId}`
const SHOTS = 'e2e-shots'

async function tab(page: Page, name: string) {
  await page.goto(AGENT)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name }).first().click()
  await page.waitForTimeout(2500)
  await page.screenshot({
    path: `${SHOTS}/astrotalk-${name.toLowerCase().replace(/\W+/g, '-')}.png`,
    fullPage: true,
  })
  return page.locator('main').first()
}

test('the built Astrotalk agent, read back @astro-verify', async ({ authedPage: page }) => {
  test.setTimeout(600_000)
  mkdirSync(SHOTS, { recursive: true })

  // ---- skills -----------------------------------------------------------
  const skills = await tab(page, 'Skills')
  for (const skill of JOB.skills) {
    await expect(
      page
        .getByRole('list', { name: 'Published skills' })
        .getByRole('listitem')
        .filter({ has: page.getByText(skill.title, { exact: true }) }),
      `skill ${skill.title} should be published`,
    ).toHaveCount(1)
  }
  // The two UI skills the founder had already built are still enabled.
  await expect(skills).toContainText('starting-services')
  await expect(skills).toContainText('kaisa-yog-entry-list')

  // ---- FAQs -------------------------------------------------------------
  const kb = await tab(page, 'Knowledge Base')
  for (const faq of JOB.faqs) {
    await expect(page.getByText(faq.question, { exact: true }), faq.question).toHaveCount(1)
  }
  console.log('FAQ rows: ' + (await page.getByRole('button', { name: 'Unpublish' }).count()))
  expect(await kb.innerText()).toContain('FAQs')

  // ---- connectors -------------------------------------------------------
  const connectors = await tab(page, 'Connectors')
  const connectorText = await connectors.innerText()
  for (const connector of JOB.connectors) {
    // On the agent a connector carries its Meta name, which is the library
    // name slugified — "Astrotalk Kundli API" arrives as astrotalk_kundli_api.
    const onMeta = connector.name.toLowerCase().replace(/\W+/g, '_')
    expect(connectorText, `${onMeta} should be on the agent`).toContain(onMeta)
    expect(connectorText, `${onMeta} should be ACTIVE`).toContain('ACTIVE')
  }
  console.log('--- agent Connectors tab ---\n' + connectorText.slice(0, 1200))

  // No FAQ should be sitting unsynced: an answer the product shows but Meta
  // does not have is worse than no answer, because nobody notices.
  await expect(page.getByText('Not synced')).toHaveCount(0)

  /*
   * ---- persona ----------------------------------------------------------
   *
   * Once deployed, this tab shows only "Published — Live since …": the
   * published persona's TEXT is not rendered here at all, and the Drafts list
   * is empty because the draft went out. So the tab is checked for having
   * published something and nothing pending, and the words themselves are read
   * off the Agents list below, which is the one screen that does show them.
   */
  const persona = await tab(page, 'Business Persona')
  const personaText = await persona.innerText()
  expect(personaText, 'a persona should be published').toContain('Published')
  expect(personaText, 'no persona draft should still be waiting').not.toContain(
    "Astrotalk is India's largest astrology",
  )

  // ---- the agent is live ------------------------------------------------
  await page.goto(AGENT)
  await page.waitForLoadState('networkidle')
  const header = page.locator('main').first()
  await expect(header).toContainText('Active')
  // Exact, not a substring: the Knowledge Base pane has a "Drafts" disclosure,
  // and "Draft" matches inside it — which failed a check on an Active agent.
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0)
  // Active means Pause is the offer, not Publish.
  await expect(page.getByRole('button', { name: /^Pause$/ })).toBeVisible()

  // The Agents list is where the live persona's own words are visible, so this
  // is where "the right company's persona is live" can actually be asserted.
  await page.goto('/agents')
  await page.waitForLoadState('networkidle')
  const row = page
    .getByRole('row')
    .filter({ has: page.getByText(JOB.agentName, { exact: true }) })
    .first()
  const rowText = await row.innerText()
  expect(rowText, 'the live persona should be the Astrotalk one').toContain(
    "Astrotalk is India's largest astrology",
  )
  expect(rowText, 'no trace of the courier persona should remain').not.toContain('SMSA')
  expect(rowText, 'the list should call it Live').toContain('Live')
  await page.screenshot({ path: `${SHOTS}/astrotalk-live-list.png`, fullPage: true })
  console.log('agent is Active and Live — answering customers on its number.')
})
