import { test as base, expect, type Page } from '@playwright/test'

/**
 * Logged-in page fixture.
 *
 * Credentials come from the environment only — APP_USER / APP_PASSWORD, or
 * frontend/.env.e2e which is covered by the existing `.env.*` gitignore rule.
 * Never hardcode them: CLAUDE.md forbids it, and these are real production
 * credentials for a shared box.
 *
 * When they are absent the test SKIPS with a readable reason instead of
 * failing. A red suite that means "you forgot a password" trains people to
 * ignore red, which is worse than no suite at all.
 */

export const APP_USER = process.env.APP_USER
export const APP_PASSWORD = process.env.APP_PASSWORD
export const hasCredentials = Boolean(APP_USER && APP_PASSWORD)

export async function login(page: Page): Promise<void> {
  await page.goto('/login')

  // Selected by input type rather than label copy — the login screen's wording
  // has changed twice during the rebrand and shouldn't break auth for every test.
  const email = page.locator('input[type="email"], input[name="email"]').first()
  const password = page.locator('input[type="password"]').first()

  await email.fill(APP_USER!)
  await password.fill(APP_PASSWORD!)
  await page.getByRole('button').first().click()

  // Landing route is /select or /dashboard depending on how many clients the
  // account can see, so assert on "no longer on /login" rather than a fixed URL.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    base.skip(
      !hasCredentials,
      'Set APP_USER and APP_PASSWORD (or frontend/.env.e2e) to run authenticated tests'
    )
    await login(page)
    await use(page)
  },
})

export { expect }
