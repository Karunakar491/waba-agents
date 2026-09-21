import { expect } from '@playwright/test'
import { test } from './fixtures/auth'

/**
 * A person answering a customer in the Inbox.
 *
 * READ-ONLY by default. The send is deliberately not exercised here: pressing
 * Send delivers a real WhatsApp message to a real person's handset, and this
 * suite runs against production. The controls are asserted to exist, be
 * reachable by role, and be correctly disabled — the delivery itself is proven
 * by hand against the reserved test number and recorded in the run notes.
 *
 * Everything selects by role. This repo has no data-testid and must keep it
 * that way, which is also what makes the inventory's coverage number mean
 * anything.
 */
test.describe('Inbox — human reply', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/inbox')
    await page.waitForLoadState('networkidle')
  })

  test('an operator can reach a reply box on a conversation', async ({ authedPage: page }) => {
    const conversations = page.getByRole('button', { name: /^Conversation with / })
    const count = await conversations.count()
    test.skip(count === 0, 'No conversations on this account to open')

    await conversations.first().click()

    const box = page.getByRole('textbox', { name: 'Reply to this customer' })
    await expect(box).toBeVisible()

    // Empty reply must not be sendable — the backend refuses it, and letting
    // the operator press Send to find that out is a worse way to learn.
    const send = page.getByRole('button', { name: 'Send reply' })
    await expect(send).toBeDisabled()

    await box.fill('typing, not sending')
    await expect(send).toBeEnabled()

    // Leave nothing behind: this runs against production.
    await box.clear()
    await expect(send).toBeDisabled()
  })

  test('the thread says whether the agent or a person is answering', async ({ authedPage: page }) => {
    const conversations = page.getByRole('button', { name: /^Conversation with / })
    test.skip((await conversations.count()) === 0, 'No conversations on this account')

    await conversations.first().click()

    // One of the two states is always true, and the operator must be able to
    // tell which: the agent is handling it, or it has gone silent and is
    // waiting on them.
    const agentSilent = page.getByText(/agent has stopped replying/i)
    const agentHandling = page.getByText(/agent is handling this conversation/i)

    await expect(agentSilent.or(agentHandling)).toBeVisible()
  })

  test('a waiting conversation offers a way to hand it back', async ({ authedPage: page }) => {
    const waiting = page.getByRole('button', { name: /waiting for a person$/ })
    test.skip((await waiting.count()) === 0, 'No conversation is waiting for a person')

    await waiting.first().click()

    await expect(page.getByRole('button', { name: 'Hand back to agent' })).toBeVisible()
    await expect(page.getByText(/agent has stopped replying/i)).toBeVisible()
  })
})
