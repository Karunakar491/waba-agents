# SOURCE — UI Skills, official Meta documentation

**Supplied by the founder 2026-09-24**, pasted verbatim below except for the
per-endpoint error tables (400/401/403/404/429/500 → `StandardError`), which
repeat identically on every endpoint and are recorded once at the bottom.

Evidence of what the page said on this date. `../ui-skills.md` is our working
summary; where the two disagree, **this one wins**.

---

## UI Skills

Retrieve UI skills for a specific entity (WhatsApp Business Phone Number).

A UI skill tells the AI agent when and how to send a UI component to a customer
— for example a call-to-action URL button, an image, a carousel, an interactive
list, a location, or a WhatsApp Flow.

**The `instruction` field should tell the agent when to send the UI component
and also contain all the information the agent needs to populate the necessary
fields.** These fields vary depending on the component type. Example for
`cta_url`:

```
If a user asks for a link to learn more about the Meta Quest, please send them
a button with body text "Click the link below", button label text "Meta Quest",
and URL https://meta.com/quest
```

Guide: [Writing UI skills](https://developers.facebook.com/documentation/meta-business-agent/usage-guides/writing-ui-skills)

Per-type field requirements:
- [Interactive CTA URL button messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-cta-url-messages)
- [Image messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/image-messages)
- [Interactive list messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages)
- [Interactive reply buttons messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages)
- [Location messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/location-messages)
- [Location request messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/location-request-messages)
- [Media carousel messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-media-carousel-messages)

**Flows are attached using the separate `flow_id` field. It is required when
`component_type` is `flow`, and is rejected for every other component type.**

**Base URL:** `https://api.facebook.com/{entity_id}/agent-ui-skills`

**Authorization:** Permission `whatsapp_business_messaging`.
(Note: unlike Skills, the two `bizai_*_enterprise_api_3p_access` capabilities
are not listed here.)

Header: `X-API-Version: "2.0.0"` (not required).
`entity_id` — the WhatsApp Business Phone Number ID for the Meta Business Agent.

## Endpoints

| Method | Endpoint |
|--------|----------|
| DELETE | `/{instruction_id}` |
| GET | `/` |
| GET | `/{instruction_id}` |
| POST | `/` |
| PUT | `/{instruction_id}` |

### DELETE /{instruction_id}
Delete an existing UI skill by its ID. **204** on success.

### GET /
Retrieve all UI skills for the specified entity. **Paginated.**

Query parameters:

| Name | Type | Description |
|------|------|-------------|
| before | string | A page of data immediately before this cursor. |
| after | string | A page of data immediately after this cursor. |
| limit | integer | Maximum number of objects that may be returned. A query may return fewer than `limit` due to filtering. **Do not depend on fewer results than the limit to indicate the end of the list — use the absence of `next` instead.** |

**200** → object:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| data | array of `BizAIOmniChannelUISkillResponse` | ✓ | The page of data returned. |
| paging | `Paging` | | Pagination metadata |

### GET /{instruction_id}
Retrieve a single UI skill by its ID.

### POST /
Create a new UI skill. **201** on success.

### PUT /{instruction_id}
Update an existing UI skill by its ID. **200** on success.

## Schemas

### BizAIOmniChannelUISkillCreateRequest

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| title | string | ✓ | A human-readable name for the UI skill. |
| component_type | enum | ✓ | One of `carousel_quick_reply`, `carousel_url`, `cta_url`, `flow`, `image`, `interactive_list`, `interactive_reply_buttons`, `location`, `location_request`. The type of rich message this UI skill sends. |
| status | enum | ✓ | `disabled` or `enabled`. Whether this UI skill is enabled and available to the AI agent. |
| instruction | string | ✓ | A description telling the AI agent when to send this UI skill. |
| flow_id | integer | | The identifier of the flow to associate. **Required when `component_type` is `flow`, and not supported otherwise.** |

### BizAIOmniChannelUISkillUpdateRequest

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| title | string | | A human-readable name for the UI skill. |
| status | enum | | `disabled` or `enabled`. **Flow skills cannot be enabled unless the corresponding flow is published.** |
| instruction | string | | A description telling the AI agent when to send this UI skill. |

**`component_type` and `flow_id` are absent from the update request — neither
can be changed after creation.**

### BizAIOmniChannelUISkillResponse

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | ✓ | A unique identifier for the UI skill. |
| title | string | ✓ | A human-readable name for the UI skill. |
| component_type | enum | ✓ | As above. |
| status | enum | ✓ | `disabled` or `enabled`. |
| instruction | string | ✓ | A description telling the AI agent when to send this UI skill. |
| flow_id | integer | | Only present for flow skills. |
| created_at | integer | ✓ | The timestamp when the UI skill was created. |
| updated_at | integer | ✓ | The timestamp when the UI skill was last updated. |

### Paging

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| cursors | `Cursors` | ✓ | Cursors to the next and previous pages |
| previous | string | | The API that will return the previous page. If absent, this is the first page. |
| next | string | | The API that will return the next page. If absent, this is the last page. **A page may be empty but still contain a `next` link — stop paging when `next` no longer appears.** |

### Cursors

| Property | Type | Description |
|----------|------|-------------|
| before | string | Points to the start of the returned page. |
| after | string | Points to the end of the returned page. |

### StandardError

| Property | Type | Required |
|----------|------|----------|
| title | string | ✓ |
| detail | string | ✓ |
| type | string | |
| status | integer | |

Every endpoint returns `StandardError` for 400, 401, 403, 404, 429 and 500.

## Authentication

`OAuthToken__Authorization` — HTTP Bearer, header `Authorization: Bearer <token>`.
Required on all endpoints.
