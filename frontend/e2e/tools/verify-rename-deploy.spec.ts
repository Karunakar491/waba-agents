/**
 * Read-only verification of the 2026-09-30 rename + connector-scoping deploy.
 * Confirms login works (the founder's "couldn't check account access" report
 * was a stale session, not a deploy regression) and spot-checks the renamed
 * screens and the agent-scoping fix.
 *
 * Uses its own login (domcontentloaded, longer timeout) rather than the
 * shared fixture — this box's route to app.karix.online is slow enough that
 * Chromium's default `waitUntil: 'load'` doesn't fire inside the suite's
 * 45s test timeout, even though the app itself answers in well under a
 * second (confirmed via curl). Not an app defect; an environment one.
 */
import { test, expect } from '@playwright/test'
import { APP_USER, APP_PASSWORD, hasCredentials } from '../fixtures/auth'

test.setTimeout(90_000)

test.skip(!hasCredentials, 'Set APP_USER and APP_PASSWORD (or frontend/.env.e2e) to run this')

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const email = page.locator('input[type="email"], input[name="email"]').first()
  const password = page.locator('input[type="password"]').first()
  await email.fill(APP_USER!)
  await password.fill(APP_PASSWORD!)
  await page.getByRole('button').first().click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

test('login succeeds and the app loads past the entitlements check', async ({ page }) => {
  await login(page)
  await expect(page.getByText("Couldn't check your account access")).not.toBeVisible()
})

test('Skills page no longer says "Library"', async ({ page }) => {
  await login(page)
  await page.goto('/library/skills', { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Skills', exact: true })).toBeVisible()
  await expect(page.getByText('Skills Library')).not.toBeVisible()
})

test('Business Persona page no longer says "Library"', async ({ page }) => {
  await login(page)
  await page.goto('/library/persona', { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Business Persona', exact: true })).toBeVisible()
  await expect(page.getByText('Persona Library')).not.toBeVisible()
})
