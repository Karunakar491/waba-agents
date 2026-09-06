import { test } from '../fixtures/auth'

/**
 * Walks every screen in the app against production and records what actually
 * happens: failed requests, console errors, and every interactive control with
 * what it is called and whether it is disabled.
 *
 * Read-only. It clicks nothing. Its output is evidence for the audit doc, not a
 * pass/fail gate — it never asserts, so it cannot go red and be ignored.
 *
 * Tagged @audit and excluded from every other suite.
 */
const ROUTES = [
  '/dashboard',
  '/agents',
  '/agents/new',
  '/library/skills',
  '/library/skills?tab=browse',
  '/library/persona',
  '/library/connectors',
  '/library/files',
  '/inbox',
  '/inbox?view=webhooks',
  '/handover',
  '/reports',
  '/debug',
  '/wabas',
  '/profile',
  '/templates',
  '/templates/iris',
  '/templates/settings',
  '/templates/debug',
]

test('@audit walk every screen and record what happens', async ({ authedPage: page }) => {
  const report: unknown[] = []

  for (const route of ROUTES) {
    const failures: string[] = []
    const consoleErrors: string[] = []

    const onResponse = (r: { status: () => number; url: () => string; request: () => { method: () => string } }) => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`)
    }
    const onConsole = (m: { type: () => string; text: () => string }) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
    }

    page.on('response', onResponse)
    page.on('console', onConsole)

    let navError: string | null = null
    try {
      await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(1200)
    } catch (e) {
      navError = e instanceof Error ? e.message.slice(0, 160) : String(e)
    }

    const surface = await page.evaluate(() => {
      const text = (el: Element) =>
        (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)

      const controls = Array.from(document.querySelectorAll('button, a[href], select, input, textarea')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        name: text(el),
        disabled: (el as HTMLButtonElement).disabled === true,
        href: el.getAttribute('href') ?? undefined,
      }))

      return {
        heading: document.querySelector('h1')?.textContent?.trim().slice(0, 80) ?? null,
        // Empty-state and error copy is the clearest signal of a half-built screen.
        emptyish: Array.from(document.querySelectorAll('p, h2, h3'))
          .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
          .filter((t) =>
            /coming soon|not available|no .* yet|nothing|empty|failed|error|unavailable|todo|placeholder/i.test(t),
          )
          .slice(0, 8),
        buttons: controls.filter((c) => c.tag === 'button').map((c) => `${c.name}${c.disabled ? ' [DISABLED]' : ''}`),
        links: controls.filter((c) => c.tag === 'a').map((c) => `${c.name} -> ${c.href}`),
        inputs: controls.filter((c) => ['input', 'select', 'textarea'].includes(c.tag)).length,
        bodyChars: document.body.innerText.length,
      }
    })

    page.off('response', onResponse)
    page.off('console', onConsole)

    report.push({ route, navError, failures: [...new Set(failures)], consoleErrors: [...new Set(consoleErrors)], ...surface })
  }

  console.log('AUDIT_JSON_START')
  console.log(JSON.stringify(report))
  console.log('AUDIT_JSON_END')
})
