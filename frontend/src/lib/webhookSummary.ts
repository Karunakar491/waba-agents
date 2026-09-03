// Client-side classification of a raw Meta webhook payload for display in the
// Webhooks tab table + detail modal. Mirrors the same entry[0].changes[0].value
// JSON paths the backend parsers already use (InboundMessageParser,
// StatusUpdateParser, OutboundEchoParser) — single entry/change, no defensive
// multi-entry handling, matching that existing convention. The backend only
// exposes the raw payload string (no pre-parsed fields), so this duplicates
// the *paths*, not the persistence logic, purely for read-only display.

export interface WebhookMetaError {
  code: number
  title: string
  message: string
  details?: string
}

export interface WebhookSummary {
  kind: 'message' | 'status' | 'echo' | 'unrecognized'
  customerNumber: string | null
  businessNumber: string | null
  metaTimestamp: string | null // epoch-seconds string, as sent by Meta
  contentPreview: string
  metaError: WebhookMetaError | null
}

const UNRECOGNIZED: WebhookSummary = {
  kind: 'unrecognized',
  customerNumber: null,
  businessNumber: null,
  metaTimestamp: null,
  contentPreview: 'Unrecognized payload shape',
  metaError: null,
}

function messageContentPreview(message: any): string {
  if (message?.type === 'text') {
    return message.text?.body || '(empty text)'
  }
  return `[${message?.type ?? 'unknown'}]`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function summarizeWebhookPayload(payload: string): WebhookSummary {
  let value: any
  try {
    value = JSON.parse(payload)?.entry?.[0]?.changes?.[0]?.value
  } catch {
    return UNRECOGNIZED
  }
  if (!value) return UNRECOGNIZED

  const businessNumber: string | null = value.metadata?.display_phone_number ?? null

  // Standby inbound — same shape as a top-level inbound message.
  const inboundMessage = value.messages?.[0] ?? value.standby?.messages?.[0]
  if (inboundMessage) {
    return {
      kind: 'message',
      customerNumber: value.contacts?.[0]?.wa_id ?? inboundMessage.from ?? null,
      businessNumber,
      metaTimestamp: inboundMessage.timestamp ?? null,
      contentPreview: messageContentPreview(inboundMessage),
      metaError: null,
    }
  }

  // Meta sends status updates either top-level or nested under standby
  // (BizAI-owned conversations) — same shape either way.
  const status = value.statuses?.[0] ?? value.standby?.statuses?.[0]
  if (status) {
    const err = status.errors?.[0]
    return {
      kind: 'status',
      customerNumber: status.recipient_id ?? null,
      businessNumber,
      metaTimestamp: status.timestamp ?? null,
      contentPreview: capitalize(status.status ?? 'unknown'),
      metaError: err
        ? { code: err.code, title: err.title, message: err.message, details: err.error_data?.details }
        : null,
    }
  }

  const echoNode = value.standby?.message_echoes?.[0]
  if (echoNode) {
    const contentNode = echoNode.message ?? echoNode
    return {
      kind: 'echo',
      customerNumber: contentNode.to ?? null,
      businessNumber,
      metaTimestamp: null,
      contentPreview: messageContentPreview(contentNode),
      metaError: null,
    }
  }

  return { ...UNRECOGNIZED, businessNumber }
}
