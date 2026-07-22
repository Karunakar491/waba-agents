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
| enabled | boolean | ✓ | Enable/disable human handoff |
| message | string | | Message shown to user on handoff |

### BizAIOmniChannelSettingsFollowup
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| enabled | boolean | ✓ | Enable/disable followup |
| followup_interval_in_seconds | integer | | One of: 0, 300, 900, 1800, 3600, 7200, 28800, 86400. 0 = disabled |
| message | string | | Followup message sent after inactivity |

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 404 Not found | 429 Rate limited | 500 Server error
