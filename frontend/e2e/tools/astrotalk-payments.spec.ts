/**
 * MUTATING. Adds Razorpay payments to the Astrotalk agent, through the
 * product's own UI, from docs/jobs/astrotalk-payments-2026-09-16.json.
 *
 * Steps, each runnable alone:
 *   @astro-pay-connector  the Razorpay connector + create_payment_link action,
 *                         with Basic auth expressed as Authorization/Basic.
 *                         Library only: no credential value, nothing on Meta.
 *   @astro-pay-skills     the payment-and-topup skill and the CTA URL UI skill.
 *                         These publish to Meta.
 *   @astro-pay-publish    publishes the connector onto the agent. Needs the
 *                         credential, so it needs RAZORPAY_KEY_ID and
 *                         RAZORPAY_KEY_SECRET and skips itself without them.
 *
 * The agent is LIVE, so every step here is additive and checks before acting:
 * nothing removes or rewrites what is already answering customers.
 *
 * Razorpay credentials are never written to this repository. The base64 is
 * built in memory from two environment variables at publish time, and the
 * product does not store the value either — it forwards it to Meta.
 *
 * Run: npx playwright test --grep @astro-pay
 */
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { test } from '../fixtures/auth'
import { SAVE_ACTION, addAction, chooseProperty, setProperty } from '../fixtures/connectors'

const JOB = JSON.parse(
  readFileSync('../docs/jobs/astrotalk-payments-2026-09-16.json', 'utf8'),
) as {
  agentId: string
  agentName: string
  connector: {
    name: string
    description: string
    baseUrl: string
    tags: string
    auth: { type: string; headers: string[]; prefix: string }
    action: { name: string; description: string; curl: string }
  }
  uiSkill: { title: string; componentType: string; status: string; instruction: string }
  skill: { title: string; description: string; body: string }
}

// See astrotalk-agent.spec.ts — ASTRO_AGENT_ID retargets these at another agent.
const AGENT_ID = process.env.ASTRO_AGENT_ID ?? JOB.agentId
const AGENT = `/agents/${AGENT_ID}`

/*
 * Which agent to publish onto. Exact, and overridable: 'Astrotalk 85916'
 * CONTAINS 'Astrotalk', so a substring match or a default name would publish to
 * the wrong agent and the already-published check would skip the right one.
 */
const AGENT_NAME = process.env.ASTRO_AGENT_NAME ?? JOB.agentName

const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

async function openTab(page: Page, tab: string) {
  await page.goto(AGENT)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: tab }).first().click()
  await page.waitForTimeout(1500)
}

/** Opens a library connector by the start of its name, or returns false. */
async function openConnectorIfPresent(page: Page, name: string): Promise<boolean> {
  await page.goto('/library/connectors')
  await page.waitForLoadState('networkidle')
  const row = page
    .locator('div.w-72')
    .getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
  if ((await row.count()) === 0) return false
  await row.first().click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 20_000 })
  return true
}

test.describe('Astrotalk payments', () => {
  test('razorpay connector @astro-pay-connector', async ({ authedPage: page }) => {
    test.setTimeout(600_000)
    const { connector } = JOB

    if (!(await openConnectorIfPresent(page, connector.name))) {
      await page.locator('div.w-72').getByRole('button', { name: 'New connector' }).click()
      await expect(page).toHaveURL(/\/library\/connectors\/new$/)
      await setProperty(page, 'Name', connector.name)
      await setProperty(page, 'Description', connector.description)
      await setProperty(page, 'Base URL', connector.baseUrl)
      await page.getByRole('button', { name: /^Create connector$/ }).click()
      await expect(page.getByRole('status')).toContainText(/Connector saved/i, { timeout: 30_000 })
      await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 30_000 })
    }
    const connectorUrl = page.url()
    console.log(`${connector.name} → ${connectorUrl}`)

    const { action } = connector
    const actions = page.getByRole('region', { name: 'Actions' })
    if (await actions.getByRole('button', { name: action.name }).count()) {
      console.log(`  action ${action.name} already exists — left alone`)
    } else {
      await addAction(page)
      await page.getByPlaceholder('e.g. product_search').fill(action.name)

      await page.getByRole('button', { name: /Import a cURL command/i }).click()
      const box = page.getByRole('region', { name: 'Import a cURL command' })
      await box.getByRole('textbox').fill(action.curl)
      await box.getByRole('button', { name: /^Check it$/ }).click()
      await box.getByRole('button', { name: /^(Import|Import anyway)$/ }).first().click()
      await expect(page.locator('#wb-method')).toHaveValue('POST', { timeout: 20_000 })

      await page.getByRole('tab', { name: 'Docs' }).click()
      await page.getByPlaceholder(/Search the catalogue/i).fill(action.description)
      await page.getByRole('button', { name: SAVE_ACTION }).click()
      await expect(page.getByRole('status')).toContainText(/Action (added|saved)/i, {
        timeout: 30_000,
      })
      await expect(page).toHaveURL(/\/actions\/\d+$/, { timeout: 30_000 })
      console.log(`  action ${action.name} → ${page.url()}`)
    }

    /*
     * Razorpay's Basic auth, expressed with the parts the form gives us. The
     * Auth dropdown has no Basic option, but `Authorization: Basic <base64>` is
     * the same bytes on the wire as `-u key_id:key_secret`, and the credential
     * row takes a free-text header name plus a prefix.
     */
    await openAction(page, connector.name, action.name)
    await page.getByRole('tab', { name: 'Authorization' }).click()
    await chooseProperty(page, 'Auth', connector.auth.type)
    await page.getByLabel('Credential field 1').fill(connector.auth.headers[0])
    await page.getByLabel('Prefix for credential 1').fill(connector.auth.prefix)
    await page.getByRole('button', { name: /^Save connector$/ }).click()
    await expect(page.getByRole('status')).toContainText(/Saved/i, { timeout: 30_000 })

    // Read it back, because an auth config that silently saved half of itself is
    // the kind of thing that only shows up as a 401 in production.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: 'Authorization' }).click()
    await expect(page.getByLabel('Credential field 1')).toHaveValue(connector.auth.headers[0], {
      timeout: 20_000,
    })
    await expect(page.getByLabel('Prefix for credential 1')).toHaveValue(connector.auth.prefix)
    console.log(`  auth: ${connector.auth.headers[0]} with prefix ${connector.auth.prefix}`)
  })

  test('payment skills @astro-pay-skills', async ({ authedPage: page }) => {
    test.setTimeout(900_000)

    // ---- the conversational skill ---------------------------------------
    await openTab(page, 'Skills')
    const published = page
      .getByRole('list', { name: 'Published skills' })
      .getByRole('listitem')
      .filter({ has: page.getByText(JOB.skill.title, { exact: true }) })
    if (await published.count()) {
      console.log(`skill ${JOB.skill.title} already published — left alone`)
    } else {
      await page.getByRole('button', { name: /^Add skill$/ }).first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 20_000 })
      await dialog.getByPlaceholder('e.g. handoff-guardrails').fill(JOB.skill.title)
      await dialog
        .getByPlaceholder(/Tell the agent WHEN to apply this skill/)
        .fill(JOB.skill.description)
      await dialog
        .getByPlaceholder('The actual instructions the agent follows for this skill.')
        .fill(JOB.skill.body)
      await dialog.getByRole('button', { name: /^Publish skill$/ }).click()
      await expect(dialog).toBeHidden({ timeout: 120_000 })
      await openTab(page, 'Skills')
      await expect(published).toHaveCount(1, { timeout: 60_000 })
      console.log(`skill ${JOB.skill.title} published`)
    }

    // ---- the CTA URL UI skill -------------------------------------------
    await openTab(page, 'Skills')
    const uiPublished = page
      .getByRole('list', { name: 'Published UI skills' })
      .getByRole('listitem')
      .filter({ has: page.getByText(JOB.uiSkill.title, { exact: true }) })
    if (await uiPublished.count()) {
      console.log(`ui skill ${JOB.uiSkill.title} already published — left alone`)
      return
    }

    await page.getByRole('button', { name: /^Add UI skill$/ }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    await dialog.getByPlaceholder('e.g. order-status-carousel').fill(JOB.uiSkill.title)
    // Two selects: component type, then status. Addressed in that order because
    // neither carries a label.
    const selects = dialog.locator('select')
    await selects.nth(0).selectOption({ label: JOB.uiSkill.componentType })
    await selects.nth(1).selectOption({ label: JOB.uiSkill.status })
    await dialog.getByPlaceholder(/Tell the agent WHEN to send this/).fill(JOB.uiSkill.instruction)
    await dialog.getByRole('button', { name: /^Add UI skill$/ }).click()
    await expect(dialog).toBeHidden({ timeout: 120_000 })

    await openTab(page, 'Skills')
    await expect(uiPublished).toHaveCount(1, { timeout: 60_000 })
    console.log(`ui skill ${JOB.uiSkill.title} published as ${JOB.uiSkill.componentType}`)
  })

  /*
   * Pins the fields the platform already knows, so the model cannot get them
   * wrong. customer.contact comes from the conversation's own WhatsApp number
   * rather than from the model's memory — a payment link addressed to the wrong
   * phone sends a stranger the receipt — and currency and the two notify flags
   * are fixed because there is no case where they should vary.
   */
  test('pin the fields we already know @astro-pay-fields', async ({ authedPage: page }) => {
    test.setTimeout(600_000)
    const sources = JOB.connector.action.fieldSources
    await openAction(page, JOB.connector.name, JOB.connector.action.name)
    await page.getByRole('tab', { name: /^Body/ }).click()
    await page.waitForTimeout(1500)

    for (const [field, value] of Object.entries(sources)) {
      if (field === 'why') continue
      const chooser = page.getByLabel(`Who fills in ${field}`, { exact: true })
      if (!(await chooser.count())) {
        console.log(`FINDING: no "Who fills in ${field}" control — left as it is`)
        continue
      }
      const options = await chooser.locator('option').allInnerTexts()
      if (options.includes(value)) {
        // A named source, e.g. the conversation's WhatsApp number.
        await chooser.selectOption({ label: value })
        console.log(`${field} ← ${value}`)
      } else {
        // Anything else is a constant, which the form takes as a fixed value.
        await chooser.selectOption({ label: 'Fixed value' })
        await page.waitForTimeout(500)
        const box = page.getByLabel(`Fixed value for ${field}`, { exact: true })
        if (!(await box.count())) {
          console.log(`FINDING: picked Fixed value for ${field} but found nowhere to type it`)
          continue
        }
        await box.fill(value)
        console.log(`${field} ← fixed "${value}"`)
      }
    }

    await page.getByRole('button', { name: SAVE_ACTION }).click()
    await expect(page.getByRole('status')).toContainText(/Action (added|saved)|Saved/i, {
      timeout: 30_000,
    })

    // Read back, because a mapping that saved half of itself is a 400 in front
    // of a paying customer.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: /^Body/ }).click()
    await page.waitForTimeout(1500)
    const contact = page.getByLabel('Who fills in customer.contact', { exact: true })
    if (await contact.count()) {
      console.log(`customer.contact is now: ${await contact.inputValue()}`)
      await expect(contact).not.toHaveValue(/Agent fills/i)
    }
  })

  /*
   * READ-ONLY. The cURL had nested objects (customer, notify, notes), and a
   * body that quietly flattened or dropped them would only show up as a
   * Razorpay validation error in front of a paying customer.
   */
  test('the payment body kept its shape @astro-pay-verify', async ({ authedPage: page }) => {
    test.setTimeout(400_000)
    await openAction(page, JOB.connector.name, JOB.connector.action.name)

    await expect(page.locator('#wb-method')).toHaveValue('POST')
    await expect(page.locator('#wb-path')).toHaveValue(
      `${JOB.connector.baseUrl}/v1/payment_links`,
    )

    await page.getByRole('tab', { name: /^Body/ }).click()
    await page.waitForTimeout(1500)
    const body = await page.locator('main').first().innerText()
    for (const field of ['amount', 'currency', 'description', 'reference_id', 'customer', 'notify']) {
      expect(body, `body should describe ${field}`).toContain(field)
    }
    console.log('--- body tab ---\n' + body.slice(body.indexOf('amount') - 200).slice(0, 1500))
  })

  test('publish razorpay to the agent @astro-pay-publish', async ({ authedPage: page }) => {
    test.setTimeout(600_000)
    test.skip(
      !KEY_ID || !KEY_SECRET,
      'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to publish the payments connector',
    )

    await openConnectorIfPresent(page, JOB.connector.name)
    const pane = await page.locator('main').first().innerText()
    if (pane.includes(AGENT_NAME) && !/Not on any agent/.test(pane)) {
      console.log(`${JOB.connector.name} is already on ${AGENT_NAME} — left alone`)
      return
    }

    await page.getByRole('button', { name: /^Publish$/ }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    await dialog.locator('select').first().selectOption({ label: AGENT_NAME })
    await expect(dialog.getByText(/Value for Authorization/i)).toBeVisible()

    // `-u key_id:key_secret` is base64 of exactly that, and the form supplies
    // the "Basic " prefix itself. Built here, never stored anywhere.
    const basic = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')
    await dialog.locator('input[type="password"]').first().fill(basic)

    await dialog.getByRole('button', { name: /^Publish to this agent$/ }).click()
    await expect(dialog).toBeHidden({ timeout: 180_000 })

    await openConnectorIfPresent(page, JOB.connector.name)
    await expect(page.locator('main').first()).toContainText(AGENT_NAME, { timeout: 60_000 })

    const connectors = await (async () => {
      await openTab(page, 'Connectors')
      return page.locator('main').first().innerText()
    })()
    expect(connectors).toContain('astrotalk_razorpay_payments')
    console.log('razorpay connector is on the agent:\n' + connectors.slice(-400))
  })
})

/** Opens an action from its connector, by name. */
async function openAction(page: Page, connector: string, action: string) {
  await openConnectorIfPresent(page, connector)
  await page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: action }).click()
  await expect(page).toHaveURL(/\/actions\/\d+$/, { timeout: 20_000 })
}
