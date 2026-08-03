# UI Skills API
Base URL: `https://api.facebook.com/{entity_id}/agent-ui-skills`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `whatsapp_business_messaging`

Note: separate surface from the plain **Skills API** (`agent_config/skills`, text-instruction skills). A UI skill tells the agent when/how to send a specific RICH MESSAGE component (carousel, CTA button, interactive list, location request, etc.) — not free-text behavior.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all UI skills (paginated: `before`/`after`/`limit`) |
| POST | / | Create a new UI skill |
| GET | /{instruction_id} | Get a specific UI skill |
| PUT | /{instruction_id} | Update a specific UI skill |
| DELETE | /{instruction_id} | Delete a specific UI skill |

---

## GET /
**Query params:** `before`, `after` (pagination cursors), `limit`
**Response 200:** `{ data: BizAIOmniChannelUISkillResponse[], paging: Paging }`

## POST /
**Body:** `BizAIOmniChannelUISkillCreateRequest`
**Response 201:** `BizAIOmniChannelUISkillResponse`

## GET /{instruction_id}
**Response 200:** `BizAIOmniChannelUISkillResponse`

## PUT /{instruction_id}
**Body:** `BizAIOmniChannelUISkillUpdateRequest` — partial update, only provided fields change
**Response 200:** `BizAIOmniChannelUISkillResponse`

## DELETE /{instruction_id}
**Response 204:** No content

---

## Schemas

### BizAIOmniChannelUISkillCreateRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | ✓ | Human-readable name |
| component_type | enum | ✓ | `carousel_quick_reply` \| `carousel_url` \| `cta_url` \| `flow` \| `image` \| `interactive_list` \| `location` \| `location_request` |
| status | enum | ✓ | `disabled` \| `enabled` |
| instruction | string | ✓ | Tells the AI agent WHEN to send this UI skill (same role as `description` on the plain Skills API) |
| flow_id | integer | | Required when component_type=`flow`; not supported for any other component_type |

### BizAIOmniChannelUISkillUpdateRequest
Same fields as Create, all optional (partial update). **Flow skills cannot be enabled unless the corresponding flow is published.**

### BizAIOmniChannelUISkillResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique UI skill ID |
| title | string | ✓ | |
| component_type | enum | ✓ | see above |
| status | enum | ✓ | `disabled` \| `enabled` |
| instruction | string | ✓ | |
| flow_id | integer | | Only present for flow skills |
| created_at | integer | ✓ | Unix timestamp |
| updated_at | integer | ✓ | Unix timestamp |

### Paging / Cursors
Standard Meta cursor pagination — `paging.cursors.{before,after}`, `paging.{previous,next}`. Stop paging when `next` is absent.

## Implementation Note (2026-08-04)
Not implemented anywhere in this codebase yet — genuinely new capability, not previously documented or built. Distinct domain from the existing agent_skill (plain Skills API) table/entity; would need its own entity/table if built (e.g. `agent_ui_skill`), not a column added to the existing Skills flow.

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 404 Not found | 429 Rate limited | 500 Server error
