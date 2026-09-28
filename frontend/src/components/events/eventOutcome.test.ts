import { describeEventOutcome } from './eventOutcome'

describe('describeEventOutcome', () => {
  it('says the event is queued before the agent starts writing', () => {
    expect(describeEventOutcome('request_received')).toEqual({
      label: 'Queued',
      tone: 'neutral',
      explanation: "We've got it. The agent is about to write the message.",
      retryable: false,
    })
  })

  it('shows writing in progress as a pending tone', () => {
    expect(describeEventOutcome('processing')).toMatchObject({
      label: 'Being written',
      tone: 'pending',
      retryable: false,
    })
  })

  it('never claims delivery for Meta’s "sent"', () => {
    const outcome = describeEventOutcome('sent')

    // Meta's `sent` is acceptance, not delivery — on a WABA with no payment
    // method the message is accepted and then never arrives. The label and the
    // explanation must both refuse to imply it reached the customer.
    expect(outcome.label).toBe('Handed to WhatsApp')
    expect(outcome.label).not.toMatch(/delivered/i)
    expect(outcome.explanation).toMatch(/isn't the same as it arriving/i)
    expect(outcome.explanation).not.toMatch(/\bdelivered\b/i)
    expect(outcome.tone).toBe('positive')
  })

  it('only claims delivery for "success"', () => {
    expect(describeEventOutcome('success')).toEqual({
      label: 'Delivered to the chat',
      tone: 'positive',
      explanation: "It's in the conversation.",
      retryable: false,
    })
  })

  describe('failed', () => {
    it('explains that the customer never opened the conversation, and does not offer a retry', () => {
      expect(
        describeEventOutcome('failed', 'Recipient has never messaged this business phone number'),
      ).toEqual({
        label: "Didn't go out",
        tone: 'destructive',
        explanation:
          "This customer has never messaged this number, so WhatsApp won't let your agent start the conversation.",
        retryable: false,
      })
    })

    it('explains a rate limit as a moment in time, and allows a retry', () => {
      expect(describeEventOutcome('failed', 'Too Many Requests: rate limit hit')).toMatchObject({
        explanation: 'WhatsApp was holding messages for this number at that moment.',
        retryable: true,
      })
    })

    it('matches Meta’s wording whatever the case', () => {
      expect(describeEventOutcome('failed', 'AGENT IS DISABLED')).toMatchObject({
        explanation: "This agent wasn't live at the time.",
        retryable: true,
      })
    })

    it('passes an unmapped reason through verbatim instead of guessing', () => {
      const outcome = describeEventOutcome('failed', 'Error 133016: something entirely new')

      expect(outcome.explanation).toContain("don't have a plain-English explanation")
      expect(outcome.explanation).toContain('Error 133016: something entirely new')
      expect(outcome.retryable).toBe(true)
    })

    it('says plainly when Meta gave no reason at all', () => {
      expect(describeEventOutcome('failed', null).explanation).toContain("didn't tell us why")
      expect(describeEventOutcome('failed', '   ').explanation).toContain("didn't tell us why")
    })
  })

  describe('skipped', () => {
    it('explains that a human holds the thread', () => {
      expect(describeEventOutcome('skipped', null, 'Agent not in control of the conversation')).toEqual(
        {
          label: 'Not sent',
          tone: 'neutral',
          explanation: 'A person from your team is handling this chat, so the agent stayed quiet.',
          retryable: false,
        },
      )
    })

    it('explains an agent that was not live, and allows a retry', () => {
      expect(describeEventOutcome('skipped', null, 'agent not live: no phone number')).toMatchObject({
        explanation: "This agent wasn't live at the time.",
        retryable: true,
      })
    })

    it('passes an unmapped skip reason through verbatim', () => {
      const outcome = describeEventOutcome('skipped', null, 'policy_hold_xyz')

      expect(outcome.explanation).toContain("don't have a plain-English explanation")
      expect(outcome.explanation).toContain('policy_hold_xyz')
      expect(outcome.retryable).toBe(false)
    })

    it('reads the skip reason, not the error message', () => {
      expect(
        describeEventOutcome('skipped', 'rate limit', 'A human is handling this conversation'),
      ).toMatchObject({
        explanation: 'A person from your team is handling this chat, so the agent stayed quiet.',
      })
    })
  })

  describe('anything else', () => {
    it('treats a missing status as unknown rather than failure', () => {
      const expected = {
        label: 'Status unknown',
        tone: 'neutral',
        explanation: "We haven't heard back from WhatsApp yet. We'll keep checking.",
        retryable: false,
      }

      expect(describeEventOutcome(null)).toEqual(expected)
      expect(describeEventOutcome(undefined)).toEqual(expected)
      expect(describeEventOutcome('')).toEqual(expected)
      expect(describeEventOutcome('   ')).toEqual(expected)
      expect(describeEventOutcome('unknown')).toEqual(expected)
    })

    it('never throws on a status string Meta has not shipped yet', () => {
      expect(describeEventOutcome('QUANTUM_ENTANGLED')).toMatchObject({ label: 'Status unknown' })
      expect(describeEventOutcome('{"not":"a status"}')).toMatchObject({ tone: 'neutral' })
    })

    it('tolerates whitespace and casing around a real status', () => {
      expect(describeEventOutcome('  SENT  ')).toMatchObject({ label: 'Handed to WhatsApp' })
    })
  })
})
