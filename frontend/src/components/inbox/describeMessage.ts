/**
 * Turns a stored WhatsApp message payload into something a human can read.
 *
 * Why this exists: the Inbox used to render every non-text message as the
 * literal string `[interactive]`, because the bubble fell back to
 * `[${contentType}]` whenever `content` was null. On this account that hid 21
 * real messages — and specifically the most informative ones in a
 * conversation, since a `list_reply` IS the customer's answer:
 *
 *   {"interactive":{"type":"list_reply","list_reply":{
 *      "title":"Aroplast Enterprise","description":"₹60/Kg | Ahmedabad, Gujarat"}}}
 *
 * An operator reading the thread saw `[interactive]` where the customer had
 * said "this supplier, this price, this city" (founder-reported 2026-09-03).
 *
 * Deliberately tolerant: anything unrecognised falls back to naming the kind
 * of message rather than throwing or rendering nothing. An inbox that hides a
 * message is worse than one that labels it awkwardly.
 */

export interface MessageDescription {
  /** The main line to show in the bubble. */
  text: string
  /** Secondary line, when the payload carries one (e.g. a list row's subtitle). */
  detail?: string
  /**
   * Short label for what kind of message this is — shown as a caption so the
   * operator knows the customer tapped something rather than typed it.
   */
  kind?: string
}

/** Reads a nested string without trusting any of the path to exist. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Treats an unknown as an object so a missing branch reads as empty rather than
 * throwing. Same tolerance as `str`: this file's whole contract is that a
 * payload it does not recognise still renders something, never an error.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function describeInteractive(node: Record<string, unknown>): MessageDescription | null {
  const type = str(node.type)
  if (!type) return null
  const inner = node[type]
  const payload: Record<string, unknown> =
    inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : {}

  switch (type) {
    case 'list_reply':
    case 'button_reply':
      return {
        text: str(payload.title) ?? 'Made a selection',
        detail: str(payload.description),
        kind: type === 'list_reply' ? 'Chose from a list' : 'Tapped a button',
      }

    /*
     * The OUTBOUND side of the same component: what the business SENT, not what
     * the customer picked from it. Everything above describes a reply; without
     * these the agent's own list rendered as a bare "Sent a list", which tells
     * whoever is handling a complaint nothing about what the customer was
     * actually offered.
     *
     * Every row is listed, not the first two and a count: someone resolving
     * "I was charged the wrong amount" needs the whole set of prices that were
     * on screen.
     */
    case 'list': {
      const action = asRecord(node.action)
      const sections = Array.isArray(action.sections) ? action.sections : []
      const rows = sections.flatMap((s) => {
        const section = asRecord(s)
        return Array.isArray(section.rows) ? section.rows : []
      })
      const options = rows
        .map((r) => {
          const row = asRecord(r)
          const title = str(row.title)
          const description = str(row.description)
          if (!title) return null
          return description ? `${title} (${description})` : title
        })
        .filter((o): o is string => o !== null)
      const heading = str(action.button) ?? str(asRecord(node.header).text) ?? 'a list'
      return {
        text: `Sent a list: ${heading}`,
        detail: options.length ? options.join(' · ') : str(asRecord(node.body).text),
        kind: 'Interactive list',
      }
    }

    case 'button': {
      const action = asRecord(node.action)
      const buttons = Array.isArray(action.buttons) ? action.buttons : []
      const labels = buttons
        .map((b) => str(asRecord(asRecord(b).reply).title) ?? str(asRecord(b).title))
        .filter((l): l is string => Boolean(l))
      return {
        text: str(asRecord(node.body).text) ?? 'Sent buttons',
        detail: labels.length ? labels.join(' · ') : undefined,
        kind: 'Buttons',
      }
    }

    case 'cta_url': {
      const params = asRecord(asRecord(node.action).parameters)
      const label = str(params.display_text)
      return {
        text: str(asRecord(node.body).text) ?? 'Sent a link button',
        detail: label ? `Button: ${label}` : str(params.url),
        kind: 'Link button',
      }
    }

    case 'call_permission_reply': {
      const response = str(payload.response)
      const accepted = response === 'accept'
      // response_source distinguishes a real tap from WhatsApp auto-declining,
      // which matters: "automatic" is not the customer saying no.
      const automatic = str(payload.response_source) === 'automatic'
      return {
        text: accepted ? 'Allowed calls from this business' : 'Did not allow calls',
        detail: automatic ? 'Answered automatically by WhatsApp, not by the customer' : undefined,
        kind: 'Call permission',
      }
    }

    case 'nfm_reply': {
      const body = str(payload.body) ?? str(payload.name)
      return { text: body ?? 'Submitted a form', kind: 'Form response' }
    }

    default:
      return { text: `Sent a ${type.replace(/_/g, ' ')}`, kind: 'Interactive' }
  }
}

export function describeMessage(
  contentType: string,
  content: string | null,
  contentJson: string | null
): MessageDescription {
  // Plain text is the common case and needs no interpretation.
  const plain = str(content)
  if (plain) return { text: plain }

  let parsed: Record<string, unknown> | null = null
  if (contentJson) {
    try {
      const value: unknown = JSON.parse(contentJson)
      if (value && typeof value === 'object') parsed = value as Record<string, unknown>
    } catch {
      // Unparseable payload: fall through to the type-name fallback below.
    }
  }

  if (parsed) {
    const interactive = parsed.interactive
    if (interactive && typeof interactive === 'object') {
      const described = describeInteractive(interactive as Record<string, unknown>)
      if (described) return described
    }

    // Media and documents carry their own useful fields.
    for (const key of ['document', 'image', 'video', 'audio', 'sticker'] as const) {
      const node = parsed[key]
      if (node && typeof node === 'object') {
        const n = node as Record<string, unknown>
        return {
          text: str(n.filename) ?? str(n.caption) ?? `Sent ${key === 'audio' ? 'a voice note' : `a ${key}`}`,
          detail: str(n.filename) ? str(n.caption) : undefined,
          kind: key === 'document' ? 'Document' : key.charAt(0).toUpperCase() + key.slice(1),
        }
      }
    }

    const location = parsed.location
    if (location && typeof location === 'object') {
      const l = location as Record<string, unknown>
      return {
        text: str(l.name) ?? str(l.address) ?? 'Shared their location',
        detail: str(l.name) ? str(l.address) : undefined,
        kind: 'Location',
      }
    }

    const text = parsed.text
    if (text && typeof text === 'object') {
      const body = str((text as Record<string, unknown>).body)
      if (body) return { text: body }
    }
  }

  // Last resort: name the kind of thing it was, without the square brackets
  // that made the old placeholder read like a rendering bug.
  const label = (contentType || 'message').replace(/_/g, ' ')
  return { text: `Sent a ${label}`, kind: 'Unrecognised' }
}
