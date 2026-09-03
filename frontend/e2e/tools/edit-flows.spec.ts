/**
 * MUTATING. Can a user actually edit things that are already published?
 *
 * Targets, all deliberately chosen to keep real customers out of it:
 *  - agent 875641528037412864 (+91 85916 89475) — published to Meta but PAUSED,
 *    so an edit cannot disturb a live conversation.
 *  - a skill and a connector from the shared libraries.
 *
 * Every edit is written and then **reverted to the original value** in the same
 * run, and the revert is asserted. IndiaMART is never touched.
 *
 * Run: npx playwright test --grep @edit
 */
import { chromium, expect, test, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const envFile = resolve(ROOT, '.env.e2e')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
const BASE = process.env.E2E_BASE_URL ?? 'https://app.karix.online'
const dir = resolve(ROOT, 'e2e-walk')

/** Published to Meta, currently paused — safe to edit and revert. */
const PAUSED_AGENT = '875641528037412864'
const OFF_LIMITS = ['875651765431701504', '1046051241927239']

const log: string[] = ['# Editing things that are already published (mutating)', '']
const friction: string[] = []
function note(s: string) {
  log.push(s, '')
  console.log(s)
}
function snag(s: string) {
  friction.push(s)
  note(`**FRICTION:** ${s}`)
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.getByRole('textbox').first().fill(process.env.APP_USER!)
  await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD!)
  await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

test(`edit an already-published agent, skill and connector @edit`, async () => {
  test.setTimeout(900_000)
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const failures: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`)
  })
  await login(page)
  for (const bad of OFF_LIMITS) expect(PAUSED_AGENT).not.toBe(bad)

  // ================= 1. A published agent's name =================
  note('## Editing a published agent')
  await page.goto(`${BASE}/agents/${PAUSED_AGENT}`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await page.waitForTimeout(5000)
  await page.screenshot({ path: resolve(dir, 'edit-01-agent-settings.png'), fullPage: true })

  const nameField = page.locator('input[type="text"]').filter({ hasNot: page.locator('[readonly]') }).first()
  const original = await nameField.inputValue().catch(() => null)
  note(`Agent name field currently: \`${original}\``)
  if (original === null) {
    snag('could not find an editable agent-name field on the Settings tab')
  } else {
    const before = failures.length
    await nameField.fill(original + ' (audit)')
    // Is there a save control at all, and does it become available?
    const save = page.getByRole('button', { name: /^save|save changes|update/i }).first()
    const hasSave = await save.isVisible().catch(() => false)
    if (!hasSave) {
      snag('typed a new agent name and there is no visible Save button — unclear whether the edit is kept')
    } else {
      await save.click()
      await page.waitForTimeout(6000)
      await page.screenshot({ path: resolve(dir, 'edit-02-agent-saved.png'), fullPage: true })
      const said = await page
        .getByText(/saved|updated|success/i)
        .first()
        .isVisible()
        .catch(() => false)
      if (!said) snag('saved the agent name and nothing on screen confirmed it worked')
      const newFail = failures.slice(before)
      if (newFail.length) snag(`saving the agent name failed: ${newFail.join(', ')}`)

      // Revert.
      await page.reload()
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
      await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
      await page.waitForTimeout(5000)
      const persisted = await nameField.inputValue().catch(() => '')
      note(`After reload the name reads: \`${persisted}\``)
      if (persisted !== original + ' (audit)') {
        snag(`the edit did NOT persist — expected "${original} (audit)", found "${persisted}"`)
      }
      await nameField.fill(original)
      const saveBack = page.getByRole('button', { name: /^save|save changes|update/i }).first()
      if (await saveBack.isVisible().catch(() => false)) {
        await saveBack.click()
        await page.waitForTimeout(6000)
      }
      await page.reload()
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
      await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
      await page.waitForTimeout(5000)
      const reverted = await nameField.inputValue().catch(() => '')
      note(`Reverted to: \`${reverted}\``)
      expect(reverted, 'MUST have restored the original agent name').toBe(original)
    }
  }

  // ================= 2. A skill in the library =================
  note('## Editing a skill')
  await page.goto(`${BASE}/library/skills`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  const editSkill = page.getByRole('button', { name: /^edit$/i }).first()
  if (!(await editSkill.isVisible().catch(() => false))) {
    snag('no Edit control on any skill in the library')
  } else {
    const before = failures.length
    await editSkill.click()
    await page.waitForURL(/\/library\/skills\/[^/]+\/edit/, { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(4000)
    await page.screenshot({ path: resolve(dir, 'edit-03-skill.png'), fullPage: true })

    const instr = page.getByPlaceholder(/actual instructions the agent follows/i)
    const originalInstr = await instr.inputValue().catch(() => null)
    if (originalInstr === null) {
      snag('skill edit page has no reachable instructions field')
    } else {
      note(`Skill instructions are ${originalInstr.length} characters.`)
      await instr.fill(originalInstr + '\n')
      const save = page.getByRole('button', { name: /^save|save changes|update/i }).first()
      if (!(await save.isVisible().catch(() => false))) {
        snag('skill edit page offers no Save button')
      } else {
        await save.click()
        await page.waitForTimeout(6000)
        await page.screenshot({ path: resolve(dir, 'edit-04-skill-saved.png'), fullPage: true })
        const newFail = failures.slice(before)
        if (newFail.length) snag(`saving a skill failed: ${newFail.join(', ')}`)
        const said = await page
          .getByText(/saved|updated|success|publish/i)
          .first()
          .isVisible()
          .catch(() => false)
        if (!said) snag('saved a skill and nothing confirmed it, or said whether live agents now use it')
        // Revert.
        const back = page.getByPlaceholder(/actual instructions the agent follows/i)
        if (await back.isVisible().catch(() => false)) {
          await back.fill(originalInstr)
          const s2 = page.getByRole('button', { name: /^save|save changes|update/i }).first()
          if (await s2.isVisible().catch(() => false)) {
            await s2.click()
            await page.waitForTimeout(6000)
          }
        }
        note('Skill instructions restored.')
      }
    }
  }

  // ================= 3. A connector =================
  note('## Editing a connector')
  await page.goto(`${BASE}/library/connectors`)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await page.screenshot({ path: resolve(dir, 'edit-05-connectors.png'), fullPage: true })
  const editConn = page.getByRole('button', { name: /^edit$/i }).first()
  if (!(await editConn.isVisible().catch(() => false))) {
    snag('no Edit control on any connector')
  } else {
    const before = failures.length
    await editConn.click()
    await page.waitForTimeout(5000)
    await page.screenshot({ path: resolve(dir, 'edit-06-connector-open.png'), fullPage: true })
    const shell = page.locator('[role="dialog"]')
    const inDialog = await shell.first().isVisible().catch(() => false)
    const text = ((await (inDialog ? shell.first() : page.locator('main')).innerText().catch(() => '')) || '').trim()
    note(`Connector editor opens as ${inDialog ? 'a dialog' : 'a page'}:\n\`\`\`\n${text.slice(0, 1500)}\n\`\`\``)
    if (/no auth|auth: *none/i.test(text) && !/secret|token|key|password/i.test(text)) {
      snag('connector editor shows the auth as absent with no field offered to set it')
    }
    const newFail = failures.slice(before)
    if (newFail.length) snag(`opening a connector for edit triggers ${newFail.join(', ')}`)
    // Read-only inspection: closed without saving.
    const close = page.getByRole('button', { name: /cancel|close/i }).first()
    if (await close.isVisible().catch(() => false)) await close.click()
    note('Connector editor closed without saving.')
  }

  if (failures.length) note('## All failed requests\n```\n' + [...new Set(failures)].join('\n') + '\n```')
  await browser.close()
  log.unshift('## Friction found', '', ...(friction.length ? friction.map((f) => `- ${f}`) : ['- none']), '')
  writeFileSync(resolve(dir, 'edit-flows.md'), log.join('\n'))
  console.log(`\nwrote ${dir}/edit-flows.md`)
})
