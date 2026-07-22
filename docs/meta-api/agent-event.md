# Agent Event API
Base URL: `https://api.facebook.com/{entity_id}/agent_event`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Purpose
Trigger agent actions from business events (e.g. payment received, document verified, order shipped).
Fire-and-forget — enqueued immediately, returns "accepted". Poll by ID for status.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | / | Trigger an agent event |
| GET | /{agent_event_id} | Poll event processing status |

---

## POST /
**Body:** `BizAIOmniChannelAgentEventRequest`
**Response 200:** `BizAIOmniChannelAgentEventResponse` — returns immediately with status "accepted"

## GET /{agent_event_id}
**Response 200:** `BizAIOmniChannelAgentEventStatusResponse`

---

## Schemas

### BizAIOmniChannelAgentEventRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| to | string | ✓ | Consumer phone number E.164 format |
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

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 404 Not found | 429 Rate limited | 500 Server error
