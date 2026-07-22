# Eligibility API
Base URL: `https://api.facebook.com/{entity_id}/agent_eligibility`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Check if phone number is eligible for Meta Business Agent |

---

## GET /
**Response 200:** `BizAIOmniChannelEligibilityResponse`

---

## Schemas

### BizAIOmniChannelEligibilityResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| is_eligible | boolean | ✓ | true = eligible, false = not eligible |

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
