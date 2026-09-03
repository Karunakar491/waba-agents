import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = resolve(ROOT, '.env.e2e')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
    if (!m || process.env[m[1]] !== undefined) continue
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

/**
 * Proves the session survives an expired access token.
 *
 * The access token lives 15 minutes and the refresh token 7 days. Rather than
 * waiting a quarter of an hour, this deletes ONLY the access_token cookie and
 * leaves the refresh_token — which is exactly the state a user is in when they
 * come back from a phone call.
 *
 * Before the fix, the next request 401'd and the app hard-navigated to /login,
 * losing whatever was on screen. This test failed against production on
 * 2026-09-04 for that reason, which is how I know it tests the right thing.
 */
test.describe('session survives an expired access token', () => {
  test.skip(
    !process.env.APP_USER || !process.env.APP_PASSWORD,
    'Set APP_USER and APP_PASSWORD (or frontend/.env.e2e) to run the authenticated specs.'
  )

  test('an expired access token is renewed silently, not bounced to /login', async ({
    page,
    context,
  }) => {
    // --- sign in normally ---
    await page.goto('/login')
    await page.getByRole('textbox').first().fill(process.env.APP_USER!)
    await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD!)
    await page.getByRole('button', { name: /sign in|log ?in|continue/i }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })

    await page.goto('/agents')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('table').or(page.getByText(/no agents/i))).toBeVisible()

    // --- simulate the 15-minute mark: drop the access token, keep the refresh ---
    const before = await context.cookies()
    const access = before.find((c) => c.name === 'access_token')
    const refresh = before.find((c) => c.name === 'refresh_token')
    expect(access, 'expected an access_token cookie after login').toBeTruthy()
    expect(refresh, 'expected a refresh_token cookie after login').toBeTruthy()

    await context.clearCookies()
    await context.addCookies(before.filter((c) => c.name !== 'access_token'))

    const stillGone = (await context.cookies()).find((c) => c.name === 'access_token')
    expect(stillGone, 'access_token should be gone for this test to mean anything').toBeFalsy()

    // --- watch for the renewal, then act like a user ---
    const refreshCalls: number[] = []
    page.on('response', (r) => {
      if (r.url().includes('/auth/refresh')) refreshCalls.push(r.status())
    })

    await page.goto('/inbox')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // The whole point: the user is still working, not staring at a login form.
    expect(page.url(), 'was bounced to the login screen instead of renewing').not.toContain('/login')
    await expect(
      page.getByRole('list').or(page.getByText(/no conversation|no messages|select a/i)).first()
    ).toBeVisible()

    // And it renewed exactly once, not once per parallel query — the backend
    // revokes the session if a rotated refresh token is replayed.
    expect(refreshCalls, 'expected exactly one successful /auth/refresh').toEqual([200])

    // A working access token should be back in place.
    const after = await context.cookies()
    expect(after.find((c) => c.name === 'access_token'), 'a new access_token should be set').toBeTruthy()
  })
})
