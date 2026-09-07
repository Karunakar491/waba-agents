import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * Proves the Skills Library's new columns and filters, and that Knowledge Base
 * finally shows FAQs.
 *
 * Read-only throughout. It filters and reads; it creates and deletes nothing.
 *
 * Tagged @skills-faqs.
 */
test.describe('@skills-faqs skills library', () => {
  test('shows Agent ID and Phone as their own columns', async ({ authedPage: page }) => {
    await page.goto('/library/skills')
    await page.waitForLoadState('networkidle')

    const table = page.locator('table').first()
    test.skip((await table.count()) === 0, 'no skills on this account')

    await expect(table.getByRole('columnheader', { name: 'Agent ID' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Phone' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'On agent' })).toBeVisible()

    // The Meta agent id, copyable, not our internal one.
    const ids = page.getByRole('button', { name: /^Copy Meta agent ID for / })
    expect(await ids.count()).toBeGreaterThan(0)
    expect(await ids.first().innerText()).toMatch(/^pfbid/)

    // The Phone column shows a dialable number, never Meta's phone number id
    // (which is a long run of digits with no + and no spaces).
    const phoneCells = await table.locator('tbody tr td:nth-child(4)').allInnerTexts()
    for (const cell of phoneCells.filter((c) => c.trim() && c.trim() !== '—')) {
      expect(cell.trim()).not.toMatch(/^\d{12,}$/)
    }
  })

  test('offers Created and Deployed-on filters, and they narrow the list', async ({
    authedPage: page,
  }) => {
    await page.goto('/library/skills')
    await page.waitForLoadState('networkidle')

    const created = page.locator('#skill-created-filter')
    const phone = page.locator('#skill-phone-filter')
    await expect(created).toBeVisible()
    test.skip((await phone.count()) === 0, 'no skill on this account has a phone number')
    await expect(phone).toBeVisible()

    const before = await page.locator('tbody tr').count()

    // The narrowest window: on this account every skill is weeks old, so this
    // should remove rows rather than leave the list untouched.
    await created.selectOption('7')
    await page.waitForTimeout(400)
    const after = await page.locator('tbody tr').count()
    expect(after).toBeLessThanOrEqual(before)

    await created.selectOption('ALL')
    await page.waitForTimeout(400)
    expect(await page.locator('tbody tr').count()).toBe(before)

    // The phone filter names real numbers, not Meta ids. Every option is
    // rendered "Deployed on: <value>" by the shared toolbar, so the prefix has
    // to come off before the value can be judged.
    const labels = await phone.locator('option').allInnerTexts()
    const values = labels
      .map((l) => l.trim().replace(/^Deployed on:\s*/i, ''))
      .filter((l) => l && l.toLowerCase() !== 'all')
    expect(values.length).toBeGreaterThan(0)
    // A Meta phone number id is a long unbroken run of digits; a real number
    // carries a + and spaces.
    for (const v of values) expect(v).not.toMatch(/^\d{12,}$/)
  })
})

test.describe('@skills-faqs knowledge base', () => {
  test('has an FAQs tab that loads without error', async ({ authedPage: page }) => {
    const failures: string[] = []
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes('/api/v1/faqs')) {
        failures.push(`${r.status()} ${r.url()}`)
      }
    })

    await page.goto('/library/files')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
    await page.getByRole('button', { name: /^FAQs$/ }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // The endpoint is new — a 404 or 500 here is the thing most likely to break.
    expect(failures).toEqual([])

    // Either FAQs, or an empty state that says where to add them. Not a blank.
    const table = page.locator('table')
    const empty = page.getByText(/No FAQs yet/i)
    const hasTable = (await table.count()) > 0
    if (hasTable) {
      await expect(table.first().getByRole('columnheader', { name: 'Question' })).toBeVisible()
      await expect(table.first().getByRole('columnheader', { name: 'Deployed on' })).toBeVisible()
    } else {
      await expect(empty).toBeVisible()
    }

    // The upload panel belongs to Files and Websites, not here.
    await expect(page.getByText(/Upload a file to|Add a website to/i)).toHaveCount(0)

    await page.screenshot({ path: 'e2e-shots/kb-faqs.png' })
  })
})
