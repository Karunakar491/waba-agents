import { expect, test as base } from '@playwright/test'
import { hasCredentials, login } from './fixtures/auth'

/**
 * The four Library destinations must be in the sidebar in EVERY rail state.
 *
 * Until 2026-09-18 they were gated on `!iconOnly`, so collapsing the rail
 * removed Knowledge Base, Skills, Connectors and Business Persona outright —
 * and the rail shipped collapsed by default, so a first-time user never saw
 * that the pages existed. An accessibility snapshot of production that day
 * listed only the eight top-level items.
 *
 * No assertion here reaches a library page by URL. Every existing spec does,
 * which is exactly why none of them caught this: the routes always worked, it
 * was the way in that was missing. Opening /dashboard is only how we get inside
 * the app shell — login lands on /select, the module picker, which has no
 * sidebar at all.
 */

const LIBRARY_LINKS = ['Knowledge Base', 'Skills', 'Connectors', 'Business Persona'] as const

/** '1' = the user collapsed it, '0' = the user expanded it, absent = never touched. */
type StoredCollapse = '0' | '1' | null

const test = base

async function openApp(page: import('@playwright/test').Page, stored: StoredCollapse) {
  // Seeded before any app code runs. Setting it after login would race the
  // reader, which runs once in a useState initialiser on first render.
  await page.addInitScript((value) => {
    if (value === null) window.localStorage.removeItem('sidebar-collapsed')
    else window.localStorage.setItem('sidebar-collapsed', value)
  }, stored)
  await login(page)
  // Login lands on /select (the module picker), which renders no sidebar.
  // Dashboard is the Business Agents module's own first screen.
  await page.goto('/dashboard')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible({ timeout: 20_000 })
  // Park the cursor in the far corner. Hover-to-peek floats the collapsed rail
  // open, so a pointer resting anywhere near it would let these assertions pass
  // against the very bug they exist to catch. Until now that was only true by
  // luck — Playwright leaves the cursor on the centred login button.
  await page.mouse.move(page.viewportSize()!.width - 1, page.viewportSize()!.height - 1)
}

for (const [name, stored] of [
  ['never touched the toggle — the default', null],
  ['deliberately collapsed the rail', '1'],
  ['deliberately expanded the rail', '0'],
] as const) {
  test(`a user who has ${name} can still reach every Library page`, async ({ page }) => {
    base.skip(!hasCredentials, 'APP_USER / APP_PASSWORD not set')
    await openApp(page, stored)

    // The <aside> maps to `complementary`; the rail's links live in the <nav>
    // inside it. Targeting the nav keeps the sign-out/account block out of scope.
    const nav = page.getByRole('navigation', { name: 'Main' })

    for (const label of LIBRARY_LINKS) {
      // Deliberately NOT preceded by a hover. Hover-to-peek floats the collapsed
      // rail open, so hovering first would let this pass against the very bug it
      // exists to catch.
      await expect(
        nav.getByRole('link', { name: label, exact: true }),
        `"${label}" must be reachable from the sidebar`,
      ).toBeVisible()
    }
  })
}

test('the rail starts expanded for someone who has never set a preference', async ({ page }) => {
  base.skip(!hasCredentials, 'APP_USER / APP_PASSWORD not set')
  await openApp(page, null)

  // The toggle names the action it would perform, so "Collapse sidebar" is the
  // honest signal that the rail is currently open — no test id, no class check.
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
})

test('a deliberate collapse survives the new default', async ({ page }) => {
  base.skip(!hasCredentials, 'APP_USER / APP_PASSWORD not set')
  await openApp(page, '1')

  // The whole reason the default reads `=== '1'` instead of `!== '0'`: someone
  // who chose a narrow rail keeps it, and only gains the icons.
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
})
