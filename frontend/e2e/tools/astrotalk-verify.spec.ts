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

  // ---- persona ----------------------------------------------------------
  const persona = await tab(page, 'Business Persona')
  const personaText = await persona.innerText()
  expect(personaText, 'the Astrotalk persona draft should be there').toContain(
    "Astrotalk is India's largest astrology",
  )
  // Say out loud whether Meta still has the courier text.
  console.log(
    personaText.includes('SMSA')
      ? 'NOTE: the SMSA Express persona is STILL the published/live version on Meta.'
      : 'The SMSA Express persona is no longer present.',
  )

  // ---- the agent is still a draft ---------------------------------------
  await page.goto(AGENT)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('main').first()).toContainText('Draft')
  console.log('agent is still a Draft — not answering customers.')
})
