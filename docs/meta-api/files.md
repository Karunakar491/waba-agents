# Files API
Base URL: `https://api.facebook.com/{entity_id}/agent_config/files`

entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `whatsapp_business_messaging`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all knowledge files |
| POST | / | Upload a new knowledge file |
| GET | /{file_id} | Get a specific file |
| DELETE | /{file_id} | Delete a specific file |

---

## GET /
**Response 200:** array of `BizAIOmniChannelKnowledgeFileResponse`

## POST /
**Content-Type:** `multipart/form-data`
**Body:** `BizAIOmniChannelKnowledgeFileRequest`
**Response 201:** `BizAIOmniChannelKnowledgeFileResponse`

## GET /{file_id}
**Response 200:** `BizAIOmniChannelKnowledgeFileResponse`

## DELETE /{file_id}
**Response 204:** No content

---

## Schemas

### BizAIOmniChannelKnowledgeFileRequest (multipart/form-data)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| file_name | string | ✓ | "The name of the file being uploaded. Include the file extension." **The content is checked against the extension declared here** — a mismatch is rejected |
| file | binary | ✓ | Max **100,000,000 bytes**. Supported: .pdf, .doc, .docx, .png, .jpg, .jpeg, .csv (if enabled), .xlsx (if enabled) |

### BizAIOmniChannelKnowledgeFileResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique file ID |
| file_name | string | ✓ | Name of the file |

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | **409 Conflict** | 429 Rate limited |
500 Server error | **503 Service unavailable**

## Re-read against Meta 2026-09-24

- **Meta checks the file's content against the extension in `file_name`.** A
  `.pdf` that is not a PDF is refused. Worth knowing before blaming our upload:
  `StepKnowledgeBase.tsx` omits the `Content-Type` override the other two
  uploaders carry, and the wizard upload is recorded as failing.
- **409 and 503 were missing from our list.** 409 most likely means a file of
  that name already exists; 503 means retry rather than report failure to a
  user. Neither is handled distinctly by us today.
- Max size is exactly 100,000,000 bytes — decimal, not 100 × 1024 × 1024. A
  client-side limit of 100 MiB would let through a file Meta refuses.
