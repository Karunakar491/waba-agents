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

## Platform mapping (verified 2026-09-03)
- `AgentService.bindPhone()` always calls `GET /{phoneNumberId}/agent_eligibility` before provisioning; throws if `is_eligible` is not true.
- No platform endpoint exposes eligibility separately — it is bind-time only.

Live GET skipped 2026-09-03 — no sandbox token in this environment.

Verified still accurate 2026-09-03 against AgentService.bindPhone (eligibility GET + onboarding POST when metaAgentId is null).

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
