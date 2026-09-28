/**
 * Turns Meta's raw agent-event status into words a business owner can act on.
 *
 * Why this exists: Meta's `sent` is an *acceptance*, not a delivery. WhatsApp
 * has taken the message off our hands; whether it ever reaches the customer's
 * phone is a separate event that arrives later — and on a WABA with no payment
 * method attached, it never arrives at all. The message is accepted and then
 * silently goes nowhere.
 *
 * So `sent` must not render as a green "Sent ✓". A single tick that sometimes
 * means "delivered" and sometimes means "accepted and then dropped" trains the
 * owner to trust a signal that is lying to them half the time, and they only
 * find out when a customer complains. `sent` and `success` are therefore two
 * different labels here, and `sent` says out loud that it is not delivery.
 *
 * Deliberately tolerant of whatever Meta sends: an unrecognised status string
 * reads as "Status unknown", and an unrecognised failure reason is passed
 * through verbatim rather than guessed at. A wrong plain-English sentence is
 * worse than Meta's own awkward one.
 */

export type MetaEventStatus =
  | 'request_received'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'success'
  | 'unknown'

export type OutcomeTone = 'neutral' | 'pending' | 'positive' | 'destructive'

export interface EventOutcome {
  /** Short status word for the screen. */
  label: string
  /** Which semantic colour the caller should use. */
  tone: OutcomeTone
  /** One sentence saying what actually happened, in the owner's terms. */
  explanation: string
  /** true when sending the same event again could plausibly work. */
  retryable: boolean
}

interface ReasonRule {
  /** Substrings of Meta's text, matched case-insensitively. */
  matches: string[]
  explanation: string
  retryable: boolean
}

const REASON_RULES: ReasonRule[] = [
  {
    matches: [
      'never messaged',
      'no conversation',
      'no active conversation',
      'conversation not found',
      'no user-initiated',
      'outside the 24',
      're-engagement',
    ],
    explanation:
      "This customer has never messaged this number, so WhatsApp won't let your agent start the conversation.",
    retryable: false,
  },
  {
    matches: [
      'human',
      'agent not in control',
      'not in control',
      'handover',
      'handed over',
      'taken over',
      'operator',
    ],
    explanation: 'A person from your team is handling this chat, so the agent stayed quiet.',
    retryable: false,
  },
  {
    matches: [
      'disabled',
      'not live',
      'inactive',
      'not active',
      'no phone number',
      'no number',
      'not published',
      'paused',
    ],
    explanation: "This agent wasn't live at the time.",
    retryable: true,
  },
  {
    matches: ['rate limit', 'rate-limit', 'ratelimit', 'throttl', 'too many requests'],
    explanation: 'WhatsApp was holding messages for this number at that moment.',
    retryable: true,
  },
]

function cleanText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function matchReason(reason: string): ReasonRule | null {
  const haystack = reason.toLowerCase()
  return REASON_RULES.find((rule) => rule.matches.some((m) => haystack.includes(m))) ?? null
}

function fromReason(
  reason: string | null,
  fallbackRetryable: boolean,
): { explanation: string; retryable: boolean } {
  if (!reason) {
    return {
      explanation: "WhatsApp didn't tell us why. We'll show their reason here if one arrives.",
      retryable: fallbackRetryable,
    }
  }

  const rule = matchReason(reason)
  if (rule) return { explanation: rule.explanation, retryable: rule.retryable }

  // Unmapped: say so, and hand the owner Meta's own words rather than a guess.
  return {
    explanation: `We don't have a plain-English explanation for this one. WhatsApp said: “${reason}”`,
    retryable: fallbackRetryable,
  }
}

export function describeEventOutcome(
  status: string | null | undefined,
  errorMessage?: string | null,
  skippedReason?: string | null,
): EventOutcome {
  const key = cleanText(status)?.toLowerCase() ?? 'unknown'

  switch (key) {
    case 'request_received':
      return {
        label: 'Queued',
        tone: 'neutral',
        explanation: "We've got it. The agent is about to write the message.",
        retryable: false,
      }

    case 'processing':
      return {
        label: 'Being written',
        tone: 'pending',
        explanation: 'The agent is writing the message now.',
        retryable: false,
      }

    case 'sent':
      return {
        label: 'Handed to WhatsApp',
        tone: 'positive',
        explanation:
          "WhatsApp took the message. That isn't the same as it arriving — if it lands we'll update this.",
        retryable: false,
      }

    case 'success':
      return {
        label: 'Delivered to the chat',
        tone: 'positive',
        explanation: "It's in the conversation.",
        retryable: false,
      }

    case 'failed': {
      const { explanation, retryable } = fromReason(cleanText(errorMessage), true)
      return { label: "Didn't go out", tone: 'destructive', explanation, retryable }
    }

    case 'skipped': {
      const { explanation, retryable } = fromReason(cleanText(skippedReason), false)
      return { label: 'Not sent', tone: 'neutral', explanation, retryable }
    }

    default:
      return {
        label: 'Status unknown',
        tone: 'neutral',
        explanation: "We haven't heard back from WhatsApp yet. We'll keep checking.",
        retryable: false,
      }
  }
}
