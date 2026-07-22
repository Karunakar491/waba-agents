# Skills API
Base URL: `https://api.facebook.com/{entity_id}/agent_config/skills`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all skills |
| POST | / | Create a new skill |
| GET | /{skill_id} | Get a specific skill |
| PUT | /{skill_id} | Update a specific skill |
| DELETE | /{skill_id} | Delete a specific skill |

---

## GET /
**Query params:** `agent_id` (optional) — if absent returns skills for most recently created settings
**Response 200:** array of `BizAIOmniChannelSkillsResponse`

## POST /
**Query params:** `agent_id` (optional)
**Body:** `BizAIOmniChannelSkillsRequest`
**Response 201:** `BizAIOmniChannelSkillsResponse`

## GET /{skill_id}
**Path params:** `skill_id` (UUID)
**Response 200:** `BizAIOmniChannelSkillsResponse`

## PUT /{skill_id}
**Body:** `BizAIOmniChannelSkillsRequest`
**Response 200:** `BizAIOmniChannelSkillsResponse`

## DELETE /{skill_id}
**Response 204:** No content

---

## Schemas

### BizAIOmniChannelSkillsRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | | Max 64 chars. Lowercase, numbers, hyphens only. No leading/trailing hyphens. e.g. `greeting-skill` |
| description | string | | Max 1024 chars. Tell agent WHEN to apply this skill. e.g. "Apply when customer first messages" |
| skill | string | | Max 20000 chars. The actual instructions. Avoid conflicts — if multiple actions on same trigger, consolidate into one skill with explicit steps |

### BizAIOmniChannelSkillsResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique skill ID |
| title | string | | Human-readable name |
| description | string | | When to apply this skill |
| skill | string | ✓ | The instruction body |
| channel | string | ✓ | "email"\|"instagram"\|"line"\|"messenger"\|"sms"\|"tiktok"\|"unknown"\|"webchat"\|"whatsapp" |
| created_at | integer | | Unix timestamp |
| metadata | object (string values) | | Key-value pairs |

## Critical Notes
- Do NOT create conflicting skills (two skills claiming priority for same trigger)
- Agent cannot resolve conflicts → duplicate/inconsistent responses
- If multiple actions on same trigger → one skill, explicit sequence of steps

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
