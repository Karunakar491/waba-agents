# Agent Test API
Base URL: `https://api.facebook.com/{entity_id}/agent_test`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Purpose
Send test messages to the agent and receive responses through the full pipeline — no consumer phone number required.
Supports multi-turn conversations via `conversation_id`.

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

## Error Codes
400 Bad request | 401 Unauthorized | 429 Rate limited | 500 Server error
