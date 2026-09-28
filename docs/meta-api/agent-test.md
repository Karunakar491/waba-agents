# Agent Test API
Base URL: `https://api.facebook.com/{entity_id}/agent_test`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Purpose
Send test messages to the agent and receive responses through the full pipeline — no consumer phone number required.
Supports multi-turn conversations via `conversation_id`.
**Tokens consumed while testing through this endpoint are NOT billed** (per official spec, 2026-08-04) — relevant given Meta's Aug 2026 Business Agent token pricing.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | / | Send a test message and get agent response |

---

## POST /
**Body:** `BizAIOmniChannelAgentTestRequest`
**Response 200:** `BizAIOmniChannelAgentTestResponse`

---

## Schemas

### BizAIOmniChannelAgentTestRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| user_msg | string | ✓ | Test message text to send to agent |
| conversation_id | string | | Provide from previous response to continue multi-turn conversation |

### BizAIOmniChannelAgentTestResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| message_id | string | ✓ | Unique ID for this message exchange |
| agent_response | string | ✓ | Agent's response text |
| conversation_id | string | ✓ | Use in next request for multi-turn conversation |
| timestamp | integer | | Unix timestamp of response |
| handoff_reason | string | | Populated if agent hands off to human |
| no_response_reason | string | | Populated if agent did not respond. e.g. "ELIGIBILITY_CHECK_FAILED" |
| quick_replies | string[] | | Suggested quick reply messages |
| product_variant_ids | string[] | | Variant IDs of products referenced in response |

## Rate Limits (new on the 2026-09-24 re-read)

| Scope | Limit |
|-------|-------|
| Per `entity_id` | **500 requests/hour** |
| Per app | **10,000 requests/hour** |

Exceeding either returns `429`.

## Error Codes
400 Bad request | 401 Unauthorized | **404 Not found** | 429 Rate limited | 500 Server error

## Re-read against Meta 2026-09-24

The 2026-09-22 paste was truncated mid-page, so this file was marked stale. The
full page is now read and the schema we already had is **correct and complete** —
every request and response field matches, including `quick_replies`,
`product_variant_ids`, `handoff_reason` and `no_response_reason`.

What was genuinely missing: the two rate limits above, and 404.

Still true and still the point: **tokens spent here are not billed**, and no
consumer phone number is needed. This is the only way to exercise an agent's
actual answers without messaging a real person — relevant to every "not proven
as behaviour" line in `STATE.md`, and it is not used by our product or our
tests at all.
