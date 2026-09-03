# Settings API
Base URL: `https://api.facebook.com/{entity_id}/agent_config/settings`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Get current agent settings |
| PUT | / | Create or fully replace agent settings |

---

## GET /
**Query params:** `agent_id` (optional) — if absent returns all settings for the channel
**Response 200:** array of `BizAIOmniChannelSettingsResponse`

## PUT /
**Query params:** `agent_id` (optional) — if absent uses create-or-fetch behavior
**Body:** `BizAIOmniChannelSettingsRequest`
**Response 200:** `BizAIOmniChannelSettingsResponse`

> Disabling agent stops AI responding to ALL threads. Re-enabling → AI responds to NEW threads only.

---

## Schemas

### BizAIOmniChannelSettingsRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| rollout | BizAIOmniChannelSettingsRollout | | Enable/disable agent |
| handoff | BizAIOmniChannelSettingsHandoff | | Human agent handoff config |
| followup | BizAIOmniChannelSettingsFollowup | | Inactive user followup config |
| ai_audience | "ALLOWLISTED_ONLY" \| "EVERYONE" | | WhatsApp only. Default: EVERYONE |

### BizAIOmniChannelSettingsResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| agent_id | string | ✓ | Use this ID to target specific agent in update/delete |
| channel | string | ✓ | "email"\|"instagram"\|"line"\|"messenger"\|"sms"\|"tiktok"\|"unknown"\|"webchat"\|"whatsapp" |
| rollout | BizAIOmniChannelSettingsRollout | ✓ | |
| handoff | BizAIOmniChannelSettingsHandoff | | |
| followup | BizAIOmniChannelSettingsFollowup | | |
| ai_audience | string | | null for non-WhatsApp |

### BizAIOmniChannelSettingsRollout
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| enabled | boolean | ✓ | true = agent on, false = agent off |

### BizAIOmniChannelSettingsHandoff
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| enabled | boolean | ✓ | **NOT "handoff on/off."** Controls only whether the CUSTOM `message` is sent (true) vs. Meta's default translated message (false) at the moment a handoff occurs. Handoff itself is NOT gated by this field — Meta's AI triggers handoff automatically based on conversation signals (low confidence, integrity violation, user asking for a human), regardless of this value. |
| message | string | | Message shown to user on handoff (only used when enabled=true) |

**Correction (2026-08-04):** the row above previously read "Enable/disable human handoff," which is wrong per the official spec — flagging for EM/EL review since `AgentService`/`AgentDeployService` name this field `handoffEnabled`/`isHandoffEnabled()` throughout, which reads exactly like "handoff feature on/off." If any code path (UI copy, validation, docs) currently tells an operator that setting this to false "disables handoff," that's a real, user-facing correctness bug — Meta will still hand off automatically, just with its own default message instead of the operator's custom one. Not fixed here — this is a documentation correction only; verify actual code/UI behavior before touching it.

### BizAIOmniChannelSettingsFollowup
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| enabled | boolean | ✓ | Enable/disable followup |
| followup_interval_in_seconds | integer | | One of: 0, 300, 900, 1800, 3600, 7200, 28800, 86400. 0 = disabled |
| message | string | | Followup message sent after inactivity |

## Platform mapping (verified 2026-09-03)
- `rollout.enabled` ↔ `Agent.status` active/paused via `deploy()` / `pause()`. Iris Phase 1 must never call these.
- `ai_audience` ↔ `PUT /api/v1/agents/{id}/settings/audience`. Not an Iris Phase 1 tool.
- `handoff.enabled`: this Meta doc (Correction 2026-08-04) says the flag controls the custom handoff *message*, not whether handoff is on. Platform UI (`AgentDetailPage`) still labels `handoffEnabled` as "Human handoff". **Unresolved product copy vs Meta semantics — do not change Java in Phase 0.**
- `followup`: preserved on RMW; no platform editor.

Live GET skipped 2026-09-03 — no sandbox token in this environment.

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 404 Not found | 429 Rate limited | 500 Server error
