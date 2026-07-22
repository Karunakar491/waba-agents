# Allowlist API
Base URL: `https://api.facebook.com/{entity_id}/agent_config/allowlist`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all allowlisted phone numbers |
| POST | / | Add a phone number to allowlist |
| DELETE | /{entry_id} | Remove an allowlist entry |

---

## GET /
**Response 200:** array of `BizAIOmniChannelAllowlistResponse`

## POST /
**Body:** `BizAIOmniChannelAllowlistRequest`
**Response 201:** `BizAIOmniChannelAllowlistResponse`

## DELETE /{entry_id}
**Path params:** `entry_id` (string, required)
**Response 204:** No content

---

## Schemas

### BizAIOmniChannelAllowlistRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| consumer_phone_number | string | ✓ | E.164 format e.g. +15551234567 |

### BizAIOmniChannelAllowlistResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique allowlist entry ID |
| consumer_phone_number | string | ✓ | E.164 format |

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
