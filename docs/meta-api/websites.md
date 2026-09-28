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
| included_sub_domains | string[] | | **Not exposed by us** |
| included_url_patterns | string[] | | **Not exposed by us** |
| excluded_sub_domains | string[] | | **Not exposed by us** |
| excluded_url_patterns | string[] | | **Not exposed by us** |
| single_urls | string[] | | Crawl these exact pages only. **Not exposed by us** |

### BizAIKnowledgeWebsiteResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique website crawl entry ID |
| url | string | ✓ | Website URL |
| crawl_status | string | | See values below |
| crawl_error | string | | Why a crawl failed. **Not read by us** |
| pages_crawled | integer | | Number of pages successfully crawled |
| last_crawled_at | integer | | Unix timestamp |
| created_at | integer | | Unix timestamp |
| included_sub_domains | string[] | | Echoes the request |
| included_url_patterns | string[] | | Echoes the request |
| excluded_sub_domains | string[] | | Echoes the request |
| excluded_url_patterns | string[] | | Echoes the request |
| single_urls | string[] | | Echoes the request |

**`crawl_status` values (all six):**
`not_started` | `pending` | `in_progress` | `completed` | `completed_no_data` | `failed`

## Platform mapping (verified 2026-09-03, re-read against Meta 2026-09-24)
- Only writable field from the platform is `url`.
- GET-by-id is local `AgentWebsite`.
- Meta owns crawling; `crawlStatus` / `pagesCrawled` come from Meta responses when present.

Live GET skipped 2026-09-03 — no sandbox token in this environment.

### Gaps found on the 2026-09-24 re-read

- **Five writable fields we never offer.** A business can only give us one URL
  and take whatever Meta crawls from it. `single_urls` alone would let someone
  say "just these three pages", and the include/exclude pairs would keep an
  agent out of a careers section or a blog. Nothing in our product can express
  any of it.
- **`completed_no_data` is a status we do not know about.** A crawl that
  finished and found nothing is not the same as one that worked, and our four
  recorded values would leave it looking like plain `completed`. Someone would
  be told their website was ingested when nothing was read from it.
  `not_started` is likewise missing.
- **`crawl_error` exists and we never read it.** When a crawl fails, Meta says
  why and we do not show it — the same shape of defect as a `blocked` skill.

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 404 Not found | 429 Rate limited | 500 Server error
