/**
 * Exploratory walk of the deployed app, from a normal user's point of view.
 *
 * Not a pass/fail suite — a reporter. It logs in, visits every route a user can
 * reach, and writes down what a human would actually see: the heading, the
 * buttons on offer, any visible error text, how long the screen took to settle,
 * and every failed request or console error underneath.
 *
 * Read-only. It navigates and reads; it never clicks a mutating control.
 *
 * Run: npx tsx e2e/tools/walk.ts   (or via `npm run walk`)
 * Output: e2e-report/walk.json + walk.md
 */
import { chromium, test, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')

// Same loader as playwright.config.ts — existing env wins over the file.
const envFile = resolve(ROOT, '.env.e2e')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
    if (!m) continue
    if (process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const BASE = process.env.E2E_BASE_URL ?? 'https://app.karix.online'
const USER = process.env.APP_USER
const PASS = process.env.APP_PASSWORD
if (!USER || !PASS) {
  console.error('Set APP_USER and APP_PASSWORD (or frontend/.env.e2e).')
  process.exit(1)
}

/** The agent the founder has ruled off-limits. Never opened, never clicked. */
const OFF_LIMITS = '875651765431701504'

const ROUTES = [
  '/dashboard',
  '/agents',
  '/agents/new',
  '/agents/882515538725572608', // live agent, unnamed — the one a user would open
  '/agents/878212557117067264', // a draft, to see the half-finished state
  '/library/skills',
  '/library/persona',
  '/library/connectors',
  '/library/files',
  '/wabas',
  '/wabas/875612227057487872',
  '/inbox',
  '/handover',
  '/templates',
  '/reports',
  '/debug',
  '/profile',
  '/select',
]

type Note = {
  route: string
  settleMs: number
  heading: string | null
  headingCount: number
  buttons: string[]
  visibleErrors: string[]
  emptyStates: string[]
  consoleErrors: string[]
  failedRequests: string[]
  rawIdsOnScreen: string[]
  bodyChars: number
}

/** Text that looks like an internal identifier being shown to a human. */
function findRawIds(text: string): string[] {
  const hits = new Set<string>()
  // 15+ digit runs: TSIDs and Meta numeric ids. Phone numbers are shorter and
  // usually spaced, so this rarely false-positives on real user-facing data.
  for (const m of text.match(/\b\d{15,20}\b/g) ?? []) hits.add(m)
  for (const m of text.match(/\bpfbid[A-Za-z0-9]{20,}/g) ?? []) hits.add(m.slice(0, 24) + '…')
  return [...hits]
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.getByRole('textbox').first().fill(USER!)
  await page.locator('input[type="password"]').fill(PASS!)
  await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function walk(page: Page, route: string): Promise<Note> {
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  const onConsole = (m: { type: () => string; text: () => string }) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300))
  }
  const onResponse = (r: { status: () => number; url: () => string }) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().replace(BASE, '')}`)
  }
  page.on('console', onConsole)
  page.on('response', onResponse)

  const started = Date.now()
  await page.goto(`${BASE}${route}`)
  try {
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
  } catch {
    /* a screen that never goes idle is itself a finding — recorded via settleMs */
  }
  const settleMs = Date.now() - started

  const body = (await page.locator('body').innerText().catch(() => '')) || ''
  const headings = await page.locator('h1, h2').allInnerTexts().catch(() => [])
  const buttons = [
    ...new Set(
      (await page.getByRole('button').allInnerTexts().catch(() => []))
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    ),
  ]

  // Anything a user would read as "this is broken".
  const visibleErrors = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) =>
      /failed|error|something went wrong|unable to|could not|unauthori[sz]ed|forbidden|try again/i.test(
        l
      )
    )
    .slice(0, 12)

  const emptyStates = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^no \w|nothing|empty|not found|get started|create your first/i.test(l))
    .slice(0, 8)

  page.off('console', onConsole)
  page.off('response', onResponse)

  return {
    route,
    settleMs,
    heading: headings[0]?.replace(/\s+/g, ' ').trim() ?? null,
    headingCount: headings.length,
    buttons,
    visibleErrors,
    emptyStates,
    consoleErrors: [...new Set(consoleErrors)],
    failedRequests: [...new Set(failedRequests)],
    rawIdsOnScreen: findRawIds(body),
    bodyChars: body.length,
  }
}

test(`walk the app as a user @walk`, async () => {
  test.setTimeout(600_000)
  const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await login(page)
console.log('logged in\n')

const notes: Note[] = []
for (const route of ROUTES) {
  if (route.includes(OFF_LIMITS)) throw new Error(`refusing to open off-limits agent: ${route}`)
  const note = await walk(page, route)
  notes.push(note)
  const flags = [
    note.failedRequests.length && `${note.failedRequests.length} failed req`,
    note.consoleErrors.length && `${note.consoleErrors.length} console err`,
    note.visibleErrors.length && `${note.visibleErrors.length} error text`,
    note.rawIdsOnScreen.length && `${note.rawIdsOnScreen.length} raw ids`,
    note.settleMs > 5000 && `slow ${note.settleMs}ms`,
    !note.heading && 'no heading',
  ]
    .filter(Boolean)
    .join(', ')
  console.log(`${route.padEnd(38)} ${String(note.settleMs).padStart(6)}ms  ${flags}`)
}

await browser.close()

const outDir = resolve(ROOT, 'e2e-walk')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'walk.json'), JSON.stringify(notes, null, 2))

const md = [
  `# Walk of ${BASE}`,
  '',
  '| Route | Settle | Heading | Failed req | Console err | Error text | Raw IDs |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...notes.map(
    (n) =>
      `| ${n.route} | ${n.settleMs}ms | ${n.heading ?? '**none**'} | ${n.failedRequests.length} | ${n.consoleErrors.length} | ${n.visibleErrors.length} | ${n.rawIdsOnScreen.length} |`
  ),
  '',
  ...notes.flatMap((n) => [
    `## ${n.route}`,
    `settle ${n.settleMs}ms · body ${n.bodyChars} chars · ${n.headingCount} headings`,
    n.buttons.length ? `**Buttons:** ${n.buttons.join(' · ')}` : '**Buttons:** none',
    n.emptyStates.length ? `**Empty states:** ${n.emptyStates.join(' / ')}` : '',
    n.visibleErrors.length ? `**Visible error text:**\n${n.visibleErrors.map((e) => `- ${e}`).join('\n')}` : '',
    n.failedRequests.length ? `**Failed requests:**\n${n.failedRequests.map((e) => `- ${e}`).join('\n')}` : '',
    n.consoleErrors.length ? `**Console errors:**\n${n.consoleErrors.map((e) => `- ${e}`).join('\n')}` : '',
    n.rawIdsOnScreen.length ? `**Internal IDs shown to the user:** ${n.rawIdsOnScreen.join(', ')}` : '',
    '',
  ]),
].join('\n')
writeFileSync(resolve(outDir, 'walk.md'), md)
  console.log(`\nwrote ${outDir}/walk.md`)
})
