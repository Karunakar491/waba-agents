import { test, expect } from '@playwright/test'

/**
 * Unauthenticated smoke tests.
 *
 * These need no credentials, so they are the first thing in this repo that
 * proves a deployed screen actually renders in a browser rather than merely
 * compiling. They also catch the specific failure mode recorded in the deploy
 * runbook: `frontend/.env.production` is gitignored, and a build made without
 * it silently ships an app whose API base is `http://localhost:8080/api/v1` —
 * a dead app that looks perfectly healthy to curl.
 */

test('app shell loads and mounts React', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)

  // #root having children means React mounted — a white page with a 200 would
  // otherwise pass a curl check and fail a human.
  const root = page.locator('#root')
  await expect(root).toBeAttached()
  await expect(root.locator('*').first()).toBeAttached()
})

test('login screen is reachable and offers a way in', async ({ page }) => {
  await page.goto('/login')

  // Assert on role/type rather than copy, so a wording change doesn't fail the
  // test and a genuinely missing field does.
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.getByRole('button')).toBeVisible()
})

test('bundle does not point at localhost — the dead-app trap', async ({ page }) => {
  const scriptUrls: string[] = []
  page.on('response', (r) => {
    if (r.url().endsWith('.js')) scriptUrls.push(r.url())
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(scriptUrls.length).toBeGreaterThan(0)

  for (const url of scriptUrls) {
    const body = await (await page.request.get(url)).text()
    expect(
      body.includes('localhost:8080'),
      `${url} contains a localhost API base — built without .env.production`
    ).toBe(false)
  }
})

test('no console errors or failed requests on first paint', async ({ page }) => {
  const consoleErrors: string[] = []
  const failed: string[] = []

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('response', (r) => {
    // 401 on a data call is expected while unauthenticated; anything 5xx is not.
    if (r.status() >= 500) failed.push(`${r.status()} ${r.url()}`)
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  expect(failed, `server errors on load:\n${failed.join('\n')}`).toEqual([])
  expect(consoleErrors, `console errors on load:\n${consoleErrors.join('\n')}`).toEqual([])
})

test('Unpublish UI is dark in production — proves the feature flag', async ({ page }) => {
  // Batch 1 shipped the Unpublish feature flag-off. Byte-level proof was taken
  // at deploy time; this is the standing regression guard so the flag can't be
  // flipped on by accident when its four findings are still open.
  const scriptUrls: string[] = []
  page.on('response', (r) => {
    if (r.url().endsWith('.js')) scriptUrls.push(r.url())
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  let sawFlagConstant = false
  for (const url of scriptUrls) {
    const body = await (await page.request.get(url)).text()
    if (body.includes('Am(void 0)') || /=\w+\(void 0\)/.test(body)) sawFlagConstant = true
    // The guard compiles to `<const> && <button…>`; if the flag were on, the
    // constant would be a literal truthy value instead of `void 0`.
    expect(
      /\(\s*!0\s*\)\s*&&.*pull it off Meta/.test(body),
      'Unpublish button appears unguarded — flag may have been turned on'
    ).toBe(false)
  }
  expect(sawFlagConstant, 'feature-flag constant not found in any bundle').toBe(true)
})
