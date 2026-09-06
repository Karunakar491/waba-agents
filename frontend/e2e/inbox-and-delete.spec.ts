import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * Proves the Inbox opens on the latest message with real dates, and that the
 * Agents list offers a delete.
 *
 * Selected by role and accessible name, like every other spec here — this
 * project has no data-testid anywhere and should not gain one for a test's
 * convenience.
 *
 * Read-only. The delete check confirms the button, its guard and its
 * confirmation dialog exist; it never confirms. These are real agents on real
 * WhatsApp numbers, and deleting one tears its configuration off Meta.
 */
test.describe('@inbox-order inbox', () => {
  test('conversations are listed newest first, with a dated timestamp', async ({
    authedPage: page,
  }) => {
    await page.goto('/inbox')
    await page.waitForLoadState('networkidle')

    const rows = page.getByRole('button', { name: /^Conversation with / })
    test.skip((await rows.count()) === 0, 'no conversations on this account')

    const stamps = rows.locator('time')
    const texts = await stamps.allInnerTexts()

    // Either a time (today) or a date carrying its year. Never "Yesterday" and
    // never a bare weekday — neither can be compared down a column.
    for (const text of texts) {
      expect(text.trim()).toMatch(/^(\d{1,2}:\d{2}\s*(am|pm)|\d{1,2} [A-Za-z]{3,4} \d{4}|—)$/i)
    }
    expect(texts.join(' ')).not.toMatch(/Yesterday|^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)

    // Newest first, read off the machine-readable datetime rather than the
    // formatted text.
    const iso = await stamps.evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLTimeElement).dateTime).filter(Boolean),
    )
    const times = iso.map((v) => new Date(v).getTime())
    const sorted = [...times].sort((a, b) => b - a)
    expect(times).toEqual(sorted)
  })

  test('opening a conversation lands on the newest message, not the oldest', async ({
    authedPage: page,
  }) => {
    await page.goto('/inbox')
    await page.waitForLoadState('networkidle')

    const rows = page.getByRole('button', { name: /^Conversation with / })
    const rowCount = await rows.count()
    test.skip(rowCount === 0, 'no conversations on this account')

    const thread = page.getByRole('log', { name: 'Messages' })

    // Not every conversation is long enough to scroll, and a short one proves
    // nothing — so walk the list until one overflows its container.
    let measured: { scrollTop: number; scrollHeight: number; clientHeight: number } | null = null
    for (let i = 0; i < Math.min(rowCount, 6); i++) {
      await rows.nth(i).click()
      await expect(thread).toBeVisible()
      // Wait for the messages themselves, not merely for the network to fall
      // quiet — the query starts after the click and the first measurement
      // would otherwise be of an empty container.
      const stamps = thread.locator('time')
      await expect(stamps.first()).toBeVisible({ timeout: 15_000 }).catch(() => {})
      if ((await stamps.count()) === 0) continue

      const m = await thread.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }))
      if (m.scrollHeight > m.clientHeight + 4) {
        measured = m
        break
      }
    }

    test.skip(measured === null, 'no conversation here is long enough to scroll')

    // Before this change scrollTop was 0 — the operator opened on a customer's
    // first message from weeks ago and had to scroll down to find what arrived.
    expect(measured!.scrollTop + measured!.clientHeight).toBeGreaterThan(
      measured!.scrollHeight - 8,
    )
  })

  test('every message carries a date and a time, not just a time', async ({ authedPage: page }) => {
    await page.goto('/inbox')
    await page.waitForLoadState('networkidle')

    const rows = page.getByRole('button', { name: /^Conversation with / })
    test.skip((await rows.count()) === 0, 'no conversations on this account')
    await rows.first().click()

    // Wait for a message to render rather than for the network to fall quiet:
    // the messages query starts after the click, so networkidle can resolve
    // against an empty thread and skip this test for the wrong reason.
    const stamps = page.getByRole('log', { name: 'Messages' }).locator('time')
    await expect(stamps.first()).toBeVisible({ timeout: 15_000 })

    for (const text of await stamps.allInnerTexts()) {
      // "6 Sept 2026, 2:32 pm" — a month and a year, not a bare "14:32".
      expect(text).toMatch(/\d{1,2} [A-Za-z]{3,4} \d{4}/)
      expect(text).toMatch(/\d{1,2}:\d{2}/)
    }
  })
})

test.describe('@inbox-order agents list', () => {
  test('a delete is offered per row, and refused while the agent is live', async ({
    authedPage: page,
  }) => {
    await page.goto('/agents')
    await page.waitForLoadState('networkidle')

    expect(await page.getByRole('button', { name: /^Delete agent / }).count()).toBeGreaterThan(0)

    // A live agent's delete must be refused: deleting rewrites its
    // configuration on Meta while it is still answering customers.
    const guarded = page.locator('button[aria-label^="Delete agent"][disabled]')
    if ((await guarded.count()) > 0) {
      await expect(guarded.first()).toHaveAttribute('title', /Pause this agent before deleting/)
    }

    const deletable = page.locator('button[aria-label^="Delete agent"]:not([disabled])')
    test.skip((await deletable.count()) === 0, 'every agent on this account is live')

    await deletable.first().click()

    // The confirmation opens and demands typing. Nothing is deleted here.
    await expect(page.getByText(/Delete/i).first()).toBeVisible()
    await expect(page.locator('input[type="text"]').first()).toBeVisible()
  })
})
