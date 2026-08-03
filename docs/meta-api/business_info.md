# Business Info API
Base URL: `https://api.facebook.com/{entity_id}/agent_config/business_info`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Get current business info (empty/default values if none configured) |
| PUT | / | Create or fully replace business info |
| DELETE | / | Reset business info to defaults — returns the default (empty) object |

---

## GET /
**Response 200:** `BizAIOmniChannelKnowledgeBusinessInfoResponse`

## PUT /
**Body:** `BizAIOmniChannelKnowledgeBusinessInfoRequest` — full replace, all provided fields overwrite existing values
**Response 200:** `BizAIOmniChannelKnowledgeBusinessInfoResponse`

## DELETE /
**Response 200:** `BizAIOmniChannelKnowledgeBusinessInfoResponse` (the reset default object)

---

## Schemas

### BizAIOmniChannelKnowledgeBusinessInfoRequest / Response
(Request and Response share the same shape)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| payment_method | string | | Accepted payment methods |
| return_policy | string | | The company return policy |
| purchase_info | string | | Information about how to make a purchase |
| delivery_and_shipping | string | | Details about delivery and shipping |
| business_description | string | | General information about the business |
| contact_info | `BizAIOmniChannelKnowledgeContactInfo` | | Null if not configured |

### BizAIOmniChannelKnowledgeContactInfo
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | | Business email address |
| hours_of_operation | string | | Business hours of operation |
| address | string | | Physical address of the business |

## Implementation Note (2026-08-04)
`BusinessProfileDeployService.getLive()`/`putBusinessInfo()` already implement GET/PUT against this exact endpoint — confirmed live against a real production number (MakeMyTrip's agent) before this doc existed. `resetLive()` implements DELETE. This doc formalizes what was already reverse-engineered and shipped; no implementation change needed from adding this file.

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
