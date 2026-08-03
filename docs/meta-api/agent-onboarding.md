# Agent Onboarding API
Base URL: `https://api.facebook.com/{entity_id}/agent_onboarding`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | / | Trigger AI agent onboarding for the entity + channel — creates the necessary entities and schedules async jobs for data preparation |

---

## POST /
**Query params:** `channel` (required) — `"email"` \| `"instagram"` \| `"line"` \| `"messenger"` \| `"sms"` \| `"tiktok"` \| `"unknown"` \| `"webchat"` \| `"whatsapp"`
**Response 201:** `BizAIOmniChannelOnboardingResponse`

---

## Schemas

### BizAIOmniChannelOnboardingResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| agent_id | string | ✓ | The ID of the agent settings entity — this is the `agent_id` used elsewhere (e.g. `MetaApiClient.scopedPath()`'s `agent_id` query param on settings/connector/skills calls) |

## Implementation Note (2026-08-04)
Not implemented anywhere in this codebase yet. Today, `AgentService.createAgent()` provisions an agent by directly `PUT`ing `agent_config/settings` (disabled) — it does not call this onboarding endpoint first. Worth checking whether `POST /agent_onboarding` is a required/recommended precursor step to settings, or a genuinely separate/optional provisioning path — the "creates the necessary entities and schedules async jobs for data preparation" wording suggests it may pre-warm something (e.g. business_info defaults, skill/FAQ scaffolding) that the current settings-first flow skips. Flag for EM review before assuming either "not needed" or "should be added" — don't silently wire it in without confirming against a live test first, same discipline as every other endpoint in this doc set.

## Error Codes
400 Bad request | 401 Unauthorized | 429 Rate limited | 500 Server error
