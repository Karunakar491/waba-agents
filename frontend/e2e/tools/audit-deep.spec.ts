import { test } from '../fixtures/auth'

/**
 * Second audit pass, with a real settle time.
 *
 * The first pass waited 1.2s after networkidle and reported several screens as
 * near-empty. That was the harness, not the app: react-query starts its fetch
 * after mount, so networkidle can resolve before a screen has any data. Reading
 * a "blank" screen off that would have put a false finding in the audit doc.
 *
 * Read-only. Clicks nothing. Never asserts.
 */
const ROUTES = [
  '/dashboard',
  '/reports',
  '/wabas',
  '/profile',
  '/handover',
  '/templates',
  '/templates/debug',
  '/templates/settings',
  '/library/files',
  '/debug',
  '/agents/new',
]

test('@audit2 read each screen once it has settled', async ({ authedPage: page }) => {
  // Eleven screens with a real settle each — well past the default per-test cap.
  test.setTimeout(300_000)
  const out: unknown[] = []

  for (const route of ROUTES) {
    const failures: string[] = []
    const onResponse = (r: { status: () => number; url: () => string }) => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`)
    }
    page.on('response', onResponse)

    await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 })
    // Long enough for a query started after mount to resolve and paint.
    await page.waitForTimeout(4000)

    const shot = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      return {
        text: main.innerText.replace(/\s+/g, ' ').trim().slice(0, 900),
        spinners: document.querySelectorAll('.animate-spin, .animate-pulse').length,
      }
    })

    page.off('response', onResponse)
    out.push({ route, failures: [...new Set(failures)], ...shot })
  }

  console.log('DEEP_JSON_START')
  console.log(JSON.stringify(out))
  console.log('DEEP_JSON_END')
})
