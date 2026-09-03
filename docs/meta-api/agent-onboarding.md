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

## Implementation Note (2026-08-04, updated 2026-09-03)
Flagged 2026-08-04 as a possibly-required precursor to `agent_config/settings`, closed 2026-08-16 as "not needed" because the settings-first create-or-fetch flow was working fine at the time (see TASKS.md's resolved item #3) — that closure went stale when Meta's behavior changed sometime before 2026-08-25.

**Now implemented**: `AgentService.bindPhone()` calls this endpoint first, gated on `agent.getMetaAgentId() == null` (i.e. only on genuinely first-time provisioning), and uses the returned `agent_id` for the subsequent `agent_config/settings` call via `MetaApiClient.scopedPath()`. This was the root-cause fix for the 2026-08-25..09-01 "can't create an agent" incident — `agent_config/settings`' create-or-fetch stopped reliably creating the entity on its own; confirmed live that calling this first resolves it. See TASKS.md #15/#16 for the fix and a known follow-up gap.

Verified still accurate 2026-09-03 against AgentService.bindPhone (eligibility GET + onboarding POST when metaAgentId is null).

## Error Codes
400 Bad request | 401 Unauthorized | 429 Rate limited | 500 Server error
