# Agent Event API

Verified verbatim against Meta's live page on 2026-09-25:
`https://developers.facebook.com/documentation/meta-business-agent/reference/operate/agent-event.md`

Base URL: `https://api.facebook.com/{entity_id}/agent_event`

entity_id = WhatsApp Business Phone Number ID **or** Instagram account ID.

Auth: `Authorization: Bearer {token}` (HTTP Bearer, `Authorization` header).
Header `X-API-Version: "2.0.0"` is offered on both endpoints but is **not** marked
required.

Any one of:
- Capability `bizai_wa_enterprise_api_3p_access`
- Capability `bizai_ig_enterprise_api_3p_access`
- Permission `whatsapp_business_messaging`

## Purpose
Trigger agent actions from business events (e.g. payment received, document verified, order shipped).

**WhatsApp is fire-and-forget; Instagram is not** (clarified 2026-09-22). On
WhatsApp the event is enqueued and the endpoint returns immediately with status
`accepted`, so the status must be polled. On Instagram the agent turn is served
*before* the response returns.

**In both cases the consumer must already have a conversation with the
business.** This cannot start one.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | / | Trigger an agent event |
| GET | /{agent_event_id} | Poll event processing status |

---

## POST /
**Path:** `entity_id` (required)
**Body:** `BizAIOmniChannelAgentEventRequestV2` (required)
**Response 200:** `BizAIOmniChannelAgentEventResponse` — "Acknowledgment that the event was accepted for processing."

## GET /{agent_event_id}
**Path:** `entity_id`, `agent_event_id` (both required). `agent_event_id` is the id
returned by `POST /{entity_id}/agent_event`.
**Response 200:** `BizAIOmniChannelAgentEventStatusResponse` — the current status of the event.

---

## Schemas

### BizAIOmniChannelAgentEventRequestV2
Schema renamed to `...V2` in Meta's current doc (2026-09-22); fields unchanged.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| to | string | ✓ | The consumer, in the form used by the entity in the path. **WhatsApp:** phone number in E.164. **Instagram:** either the Instagram-scoped ID from the webhook, or the username with or without a leading `@` — a value made up only of digits is always read as a scoped ID, never as a username. The consumer must already have a conversation with the business. |
| event | Event | ✓ | Event-specific fields |

### Event (inline)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | string | ✓ | Partner-defined event ID. e.g. "document_verified", "payment_received". Max 256 chars |
| description | string | ✓ | Human-readable description. e.g. "User's identity document has been verified". Max 1024 chars |
| payload | string | ✓ | Opaque JSON string passed through to agent as-is. Max 4096 chars |

### BizAIOmniChannelAgentEventResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| status | string | ✓ | "accepted" when successfully enqueued |
| agent_event_id | string | | ID to poll for status |

### BizAIOmniChannelAgentEventStatusResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| status | string | ✓ | "request_received" \| "processing" \| "sent" \| "failed" \| "skipped" \| "success" |
| event_type | string | ✓ | Partner-defined event identifier supplied at submission |
| error_message | string | | Failure summary when status=failed |
| skipped_reason | string | | Skip reason when status=skipped |
| created_at | string | ✓ | ISO 8601 timestamp |
| updated_at | string | ✓ | ISO 8601 timestamp |

### StandardError
Body returned on every non-2xx.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | ✓ | |
| detail | string | ✓ | |
| type | string | | |
| status | integer | | |

## Error Codes
| Code | Meaning | POST | GET |
|------|---------|------|-----|
| 400 | Bad request | ✓ | ✓ |
| 401 | Unauthorized | ✓ | ✓ |
| 403 | Forbidden | ✓ | ✓ |
| 404 | Not found | — | ✓ |
| 429 | Too many requests | ✓ | ✓ |
| 500 | Server error | ✓ | ✓ |

`404` is documented only on `GET /{agent_event_id}` — POST has no 404.
