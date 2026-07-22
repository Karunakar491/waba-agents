# Websites API
Base URL: `https://api.facebook.com/{entity_id}/agent_config/websites`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all website crawl entries |
| POST | / | Add a website URL to crawl |
| GET | /{website_id} | Get a specific website entry |
| PUT | /{website_id} | Update a website entry |
| DELETE | /{website_id} | Delete a website entry |

---

## GET /
**Response 200:** array of `BizAIKnowledgeWebsiteResponse`

## POST /
**Body:** `BizAIKnowledgeWebsiteRequest`
**Response 201:** `BizAIKnowledgeWebsiteResponse`

## GET /{website_id}
**Response 200:** `BizAIKnowledgeWebsiteResponse`

## PUT /{website_id}
**Body:** `BizAIKnowledgeWebsiteRequest`
**Response 200:** `BizAIKnowledgeWebsiteResponse`

## DELETE /{website_id}
**Response 204:** No content

---

## Schemas

### BizAIKnowledgeWebsiteRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| url | string | ✓ | URL of the website to crawl |

### BizAIKnowledgeWebsiteResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique website crawl entry ID |
| url | string | ✓ | Website URL |
| crawl_status | string | | "pending" \| "in_progress" \| "completed" \| "failed" |
| pages_crawled | integer | | Number of pages successfully crawled |
| last_crawled_at | integer | | Unix timestamp |
| created_at | integer | | Unix timestamp |

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 404 Not found | 429 Rate limited | 500 Server error
