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
| file_name | string | ✓ | Name of the file |
| file | binary | ✓ | Max 100MB. Supported: .pdf, .doc, .docx, .png, .jpg, .jpeg, .csv (if enabled), .xlsx (if enabled) |

### BizAIOmniChannelKnowledgeFileResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique file ID |
| file_name | string | ✓ | Name of the file |

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
