# Thread Control API
Base URL: `https://api.facebook.com/business/whatsapp/phone_numbers/{phone_number_id}/thread_control`

Auth: Bearer token in header AND access_token/oauth_token in query params (all three required)
`X-API-Version: 1.0.0` (note: v1.0.0, not v2.0.0)
Required: `whatsapp_business_messaging`

## Purpose
Controls which party handles a conversation — your app or Meta Business Agent.

**Key rule:**
- Your app takes control by simply **sending a message** to the conversation
- To hand control BACK to Meta Business Agent → call this endpoint with `action: "release"`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | / | Release thread control back to Meta Business Agent |

---

## POST /
**Body:** `ThreadControlRequest`
**Response 200:** `ThreadControlResponse`

---

## Schemas

### ThreadControlRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| messaging_product | "whatsapp" | ✓ | Must be "whatsapp" |
| action | "pass" \| "release" | ✓ | Only "release" is currently supported. "pass" reserved for future use. You must hold thread control to call this. |
| to | string | | Consumer phone number or WhatsApp ID |
| recipient | string | | Business-scoped user ID. Accepted but not wired yet — use `to` instead |

### ThreadControlResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| messaging_product | "whatsapp" | ✓ | Always "whatsapp" |

## Authentication (all three required)
| Method | Location | Notes |
|--------|----------|-------|
| Bearer token | `Authorization` header | |
| access_token | Query param | |
| oauth_token | Query param | |

## Critical Notes
- **API version is 1.0.0** — not 2.0.0 like other APIs
- **Base URL is different** — `api.facebook.com/business/whatsapp/phone_numbers/...` not `api.facebook.com/{entity_id}/...`
- Your app takes control by sending a message — no API call needed for that direction
- "release" = hand control back to Meta Business Agent → agent resumes for NEW messages only
- You must currently hold thread control to call release

## Handoff Flow
```
1. Meta Business Agent handles conversation (default)
2. Handoff event triggers (configured in settings)
3. Your app receives webhook: messaging_handovers field
4. Your app sends a message → takes control
5. Your app handles the conversation
6. Your app calls POST /thread_control with action="release"
7. Meta Business Agent resumes (new messages only)
```
