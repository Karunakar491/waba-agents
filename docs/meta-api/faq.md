# FAQ API
Base URL: `https://api.facebook.com/{entity_id}/agent_config/faq`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all FAQs |
| POST | / | Create a new FAQ |
| GET | /{faq_id} | Get a specific FAQ |
| PUT | /{faq_id} | Update a specific FAQ |
| DELETE | /{faq_id} | Delete a specific FAQ |

---

## GET /
**Response 200:** array of `BizAIOmniChannelKnowledgeFAQResponse`

## POST /
**Body:** `BizAIOmniChannelKnowledgeFAQRequest`
**Response 201:** `BizAIOmniChannelKnowledgeFAQResponse`

## GET /{faq_id}
**Response 200:** `BizAIOmniChannelKnowledgeFAQResponse`

## PUT /{faq_id}
**Body:** `BizAIOmniChannelKnowledgeFAQRequest`
**Response 200:** `BizAIOmniChannelKnowledgeFAQResponse`

## DELETE /{faq_id}
**Response 204:** No content

---

## Schemas

### BizAIOmniChannelKnowledgeFAQRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| question | string | ✓ | Natural customer phrasing e.g. "What is your return policy?" — not topic labels |
| answer | string | ✓ | Factual, concise, self-contained. No references to other FAQs — agent retrieves each independently |
| metadata | object (string values) | | Key-value pairs |

### BizAIOmniChannelKnowledgeFAQResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique FAQ entry ID |
| question | string | ✓ | |
| answer | string | ✓ | |
| created_at | integer | | Unix timestamp |
| metadata | object (string values) | | Key-value pairs |

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
