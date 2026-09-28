/**
 * MUTATING. Completes the Astrotalk booking journey through the product's own
 * UI, from docs/jobs/astrotalk-journey-2026-09-16.json.
 *
 * Steps, each runnable alone:
 *   @astro-journey-actions  the two Razorpay lookup actions, and create_payment_link
 *                           brought up to the reconstructible reference_id. Library
 *                           only — nothing reaches Meta, an agent or a phone number.
 *   @astro-journey-ui       the two UI skills, created DISABLED. They exist on Meta
 *                           and are never sent, so this changes nothing for the
 *                           customers already using this agent.
 *   @astro-journey-skills   the three new conversational skills. These publish to
 *                           Meta, but stay dormant while the UI skills they lean on
 *                           are disabled.
 *   @astro-journey-verify   reads it all back.
 *
 * Enabling a UI skill is deliberately NOT here: each one goes live on its own,
 * followed by a real conversation on the number, because rendering cannot be
 * verified any other way.
 *
 * The agent is LIVE. Every step is additive and checks before acting, so a
 * failure halfway is fixed by running it again rather than by undoing.
 *
 * Run: npx playwright test --grep @astro-journey
 */
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { test } from '../fixtures/auth'
import { SAVE_ACTION, addAction } from '../fixtures/connectors'

type Action = { name: string; description: string; curl: string }

const JOB = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-journey-2026-09-16.json', 'utf8'),
) as {
  agentId: string
  uiSkills: { title: string; componentType: string; status: string; instruction: string }[]
  skills: { title: string; description: string; body: string }[]
  razorpayActions: { connector: string; actions: Action[] }
}
const PAYMENTS = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-payments-2026-09-16.json', 'utf8'),
) as { connector: { name: string; action: Action } }

const AGENT = `/agents/${JOB.agentId}`

async function openTab(page: Page, tab: string) {
  await page.goto(AGENT)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: tab }).first().click()
  await page.waitForTimeout(1500)
}

async function openConnector(page: Page, name: string) {
  await page.goto('/library/connectors')
  await page.waitForLoadState('networkidle')
  await page
    .locator('div.w-72')
    .getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    .first()
    .click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 20_000 })
  await waitForActions(page)
}

/**
 * The Actions table fetches its rows after the pane renders, and reads
 * "Loading actions…" until it has them. An existence check made during that
 * window finds nothing — which is how this script tried to create
 * check_payment_status a second time and earned "This connector already has an
 * action called check_payment_status".
 */
async function waitForActions(page: Page) {
  const region = page.getByRole('region', { name: 'Actions' })
  await expect(region).not.toContainText('Loading actions', { timeout: 30_000 })
}

/** Pastes a cURL into the open action editor and applies it. */
async function importCurl(page: Page, curl: string) {
  await page.getByRole('button', { name: /Import a cURL command/i }).click()
  const box = page.getByRole('region', { name: 'Import a cURL command' })
  await box.getByRole('textbox').fill(curl)
  await box.getByRole('button', { name: /^Check it$/ }).click()
  await box.getByRole('button', { name: /^(Import|Import anyway)$/ }).first().click()
}

/**
 * An action description is capped at 1024 characters. Over that, Save shows
 * "description: size must be between 0 and 1024" in an alert and silently does
 * nothing — no toast, no navigation, so the write just fails to happen. Checked
 * before typing rather than discovered after.
 */
async function setDescription(page: Page, description: string) {
  expect(description.length, 'action description must fit 1024').toBeLessThanOrEqual(1024)
  await page.getByRole('tab', { name: 'Docs' }).click()
  await page.getByPlaceholder(/Search the catalogue/i).fill(description)
}

async function saveAction(page: Page) {
  await page.getByRole('button', { name: SAVE_ACTION }).click()
  // A rejected save surfaces as an alert and nothing else, so read that first —
  // waiting on a toast that will never come reports a validation failure as a
  // timeout and hides what the app actually said.
  const alert = page.getByRole('alert')
  if (await alert.count()) {
    const said = await alert.first().innerText()
    if (said.trim()) throw new Error(`the editor refused to save: ${said.trim()}`)
  }
  await expect(page.getByRole('status')).toContainText(/Action (added|saved)|Saved/i, {
    timeout: 30_000,
  })
}

/** What the Params tab ended up holding — path and query rows are fiddly. */
async function reportParams(page: Page, label: string) {
  await page.getByRole('tab', { name: /^Params/ }).click()
  await page.waitForTimeout(1000)
  const rows = await page.locator('input[id^="query-parameters-"], input[id^="path-"]').evaluateAll(
    (els) => els.map((e) => `${(e as HTMLInputElement).id}="${(e as HTMLInputElement).value}"`),
  )
  const selects = await page
    .locator('main select')
    .evaluateAll((els) =>
      els
        .map((e) => {
          const s = e as HTMLSelectElement
          return `${s.getAttribute('aria-label') ?? s.id ?? '?'} = ${s.options[s.selectedIndex]?.text ?? ''}`
        })
        .filter((s) => /fills|param/i.test(s)),
    )
  console.log(`  [${label}] params: ${rows.join(' ') || '(none)'}`)
  if (selects.length) console.log(`  [${label}] sources: ${selects.join(' | ')}`)
}

test.describe('Astrotalk journey', () => {
  test('razorpay lookup actions @astro-journey-actions', async ({ authedPage: page }) => {
    test.setTimeout(900_000)
    const { connector, actions } = JOB.razorpayActions

    // ---- create_payment_link, brought up to date -------------------------
    // Its reference_id used a clock time, which the model cannot recompute on a
    // later turn — so a paying customer could not be looked up again. Re-import
    // rewrites the body to the new shape (wider notes) in one go; the field
    // sources are re-pinned afterwards by @astro-pay-fields.
    await openConnector(page, connector)
    await page
      .getByRole('region', { name: 'Actions' })
      .getByRole('button', { name: PAYMENTS.connector.action.name })
      .click()
    await expect(page).toHaveURL(/\/actions\/\d+$/, { timeout: 20_000 })
    await importCurl(page, PAYMENTS.connector.action.curl)
    await expect(page.locator('#wb-method')).toHaveValue('POST', { timeout: 20_000 })
    await setDescription(page, PAYMENTS.connector.action.description)
    await saveAction(page)
    console.log(`${PAYMENTS.connector.action.name} updated (reference_id + wider notes)`)

    // ---- the two lookups -------------------------------------------------
    for (const action of actions) {
      await openConnector(page, connector)
      const existing = page.getByRole('region', { name: 'Actions' })
      if (await existing.getByRole('button', { name: action.name }).count()) {
        console.log(`  action ${action.name} already exists — left alone`)
        continue
      }

      await addAction(page)
      await page.getByPlaceholder('e.g. product_search').fill(action.name)
      await importCurl(page, action.curl)
      await expect(page.locator('#wb-method')).toHaveValue('GET', { timeout: 20_000 })

      /*
       * The id has to be a PATH token, not the literal one the cURL carried, or
       * every customer's status check would fetch the same example link. The
       * editor derives a path param from a {token} in the URL.
       */
      if (action.name === 'check_payment_status') {
        await page.locator('#wb-path').fill('https://api.razorpay.com/v1/payment_links/{id}')
        await page.locator('#wb-path').blur()
        await page.waitForTimeout(1500)
      }

      await setDescription(page, action.description)
      await saveAction(page)
      await expect(page).toHaveURL(/\/actions\/\d+$/, { timeout: 30_000 })
      console.log(`  action ${action.name} → ${page.url()}`)
      await reportParams(page, action.name)
    }

    /*
     * ---- reference_id must be the AGENT's to fill -------------------------
     *
     * A query value in an imported cURL arrives as a FIXED value, so
     * reference_id came in pinned to the example link out of the documentation
     * — every customer's lookup would have fetched that same link and reported
     * whatever it said. Run unconditionally, because the action exists after
     * the first pass and the creation branch would then never correct it.
     */
    await openConnector(page, connector)
    await page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: 'find_payment_link' }).click()
    await expect(page).toHaveURL(/\/actions\/\d+$/, { timeout: 20_000 })
    await page.getByRole('tab', { name: /^Params/ }).click()
    await page.waitForTimeout(1500)
    const fill = page.locator('#query-parameters-0-fill')
    if ((await fill.inputValue()) !== 'agent') {
      await fill.selectOption({ label: 'Agent fills this in' })
      await page.waitForTimeout(500)
      const fixed = page.locator('#query-parameters-0-fixedvalue')
      if (await fixed.count()) await fixed.fill('')
      await page
        .locator('#query-parameters-0-description')
        .fill('The reconstructible booking reference: astrotalk-<last 10 digits of phone>-<astrologer_id>-<minutes>')
      await saveAction(page)
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: /^Params/ }).click()
      await page.waitForTimeout(1500)
    }
    console.log(`  find_payment_link reference_id fill = ${await fill.inputValue()}`)
    expect(await fill.inputValue(), 'reference_id must not be a fixed value').toBe('agent')

    // ---- read back -------------------------------------------------------
    await openConnector(page, connector)
    // The table fetches its rows after the pane renders, so assert on the row
    // being there rather than on a snapshot that can read "Loading actions…".
    const region = page.getByRole('region', { name: 'Actions' })
    await expect(region.getByRole('button', { name: actions[0].name })).toBeVisible({
      timeout: 30_000,
    })
    const table = await region.innerText()
    for (const action of [...actions, PAYMENTS.connector.action]) {
      expect(table, `${action.name} should be on the connector`).toContain(action.name)
    }
    console.log('--- actions now ---\n' + table.slice(0, 1200))
  })

  test('journey UI skills @astro-journey-ui', async ({ authedPage: page }) => {
    test.setTimeout(900_000)

    for (const ui of JOB.uiSkills) {
      // Meta truncates rather than rejects, and a half-instruction is a silently
      // wrong component. Check before typing.
      expect(ui.instruction.length, `${ui.title} instruction must fit 1024`).toBeLessThanOrEqual(
        1024,
      )

      await openTab(page, 'Skills')
      const existing = page
        .getByRole('list', { name: 'Published UI skills' })
        .getByRole('listitem')
        .filter({ has: page.getByText(ui.title, { exact: true }) })
      if (await existing.count()) {
        console.log(`ui skill ${ui.title} already there — left alone`)
        continue
      }

      await page.getByRole('button', { name: /^Add UI skill$/ }).first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 20_000 })
      await dialog.getByPlaceholder('e.g. order-status-carousel').fill(ui.title)
      const selects = dialog.locator('select')
      await selects.nth(0).selectOption({ label: ui.componentType })
      await selects.nth(1).selectOption({ label: ui.status })
      await dialog.getByPlaceholder(/Tell the agent WHEN to send this/).fill(ui.instruction)
      await dialog.getByRole('button', { name: /^Add UI skill$/ }).click()
      await expect(dialog).toBeHidden({ timeout: 120_000 })

      await openTab(page, 'Skills')
      await expect(existing).toHaveCount(1, { timeout: 60_000 })
      console.log(`ui skill ${ui.title} added as ${ui.componentType}, ${ui.status}`)
    }
  })

  test('journey skills @astro-journey-skills', async ({ authedPage: page }) => {
    test.setTimeout(1_800_000)

    for (const skill of JOB.skills) {
      await openTab(page, 'Skills')
      const published = page
        .getByRole('list', { name: 'Published skills' })
        .getByRole('listitem')
        .filter({ has: page.getByText(skill.title, { exact: true }) })
      if (await published.count()) {
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
      await expect(dialog).toBeHidden({ timeout: 120_000 })

      await openTab(page, 'Skills')
      await expect(published).toHaveCount(1, { timeout: 60_000 })
      console.log(`skill ${skill.title} published`)
    }
  })

  test('read the journey back @astro-journey-verify', async ({ authedPage: page }) => {
    test.setTimeout(600_000)

    const skills = await openTab(page, 'Skills').then(() => page.locator('main').first())
    for (const skill of JOB.skills) {
      await expect(
        page
          .getByRole('list', { name: 'Published skills' })
          .getByRole('listitem')
          .filter({ has: page.getByText(skill.title, { exact: true }) }),
        `${skill.title} should be published`,
      ).toHaveCount(1)
    }
    const uiList = page.getByRole('list', { name: 'Published UI skills' })
    for (const ui of JOB.uiSkills) {
      const row = uiList
        .getByRole('listitem')
        .filter({ has: page.getByText(ui.title, { exact: true }) })
      await expect(row, `${ui.title} should be there`).toHaveCount(1)
      // The row carries the component-type label and the status badge, so both
      // are assertable without opening the modal.
      await expect(row).toContainText(ui.componentType)
      await expect(row).toContainText(ui.status)
    }

    // Nothing that was already working may have been disturbed.
    for (const untouched of ['starting-services', 'kaisa-yog-entry-list', 'payment-cta-url']) {
      await expect(page.getByText(untouched, { exact: true }), untouched).toHaveCount(1)
    }
    await expect(skills).toContainText('guardrails')

    await page.goto(AGENT)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main').first()).toContainText('Active')
    await page.screenshot({ path: 'e2e-shots/astrotalk-journey-skills.png', fullPage: true })
    console.log('journey skills in place; agent still Active')
  })
})
