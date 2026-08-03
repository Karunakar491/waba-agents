# Delete Agent API
Base URL: `https://api.facebook.com/{entity_id}/delete_agent`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `whatsapp_business_messaging`

## Purpose
Removes the Meta Business Agent from the specified phone number. When the last agent on the account is removed, disconnects the integration.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| DELETE | / | Delete the agent config for this entity |

---

## DELETE /
**Response 200:** `BizAIOmniChannelDeleteAgentResponse`

---

## Schemas

### BizAIOmniChannelDeleteAgentResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| deleted_agent_id | string | | The ID of the agent settings removed, or null if nothing was there to remove |

## Implementation Note (2026-08-04)
Already implemented — `AgentDeployService.deleteFromMeta()` calls `DELETE .../delete_agent` (requires agent PAUSED first, resets local Agent row to draft). This doc formalizes an endpoint that was already reverse-engineered and shipped; no implementation change.

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 429 Rate limited | 500 Server error
