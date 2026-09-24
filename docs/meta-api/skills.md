# Skills API
Base URL: `https://api.facebook.com/{entity_id}/agent_config/skills`

entity_id = WhatsApp Business Phone Number ID, Instagram business account ID, or
Instagram username

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `bizai_wa_enterprise_api_3p_access` OR `bizai_ig_enterprise_api_3p_access`
OR `whatsapp_business_messaging`

**Refreshed 2026-09-24** from the official spec supplied by the founder — the
page as supplied is kept verbatim at
[`sources/2026-09-24-skills-official.md`](sources/2026-09-24-skills-official.md)
and wins over this summary if the two ever disagree. Two
things changed since the 2026-09-03 reading — see *What changed* at the bottom.

Skills replace the `instructions` resource used in API version 1.0.0.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all skills |
| POST | / | Create a new skill |
| GET | /{skill_id} | Get a specific skill |
| PUT | /{skill_id} | Update a specific skill — **partial** |
| DELETE | /{skill_id} | Delete a specific skill |

---

## GET /
**Query params:** `agent_id` (optional settings ID) — when absent, returns skills
for the most recently created settings for the channel.
**Response 200:** array of `BizAIOmniChannelSkillsResponse`

Meta's guidance: this response is the agent's whole behavioural configuration, so
read it before creating a skill and check the situation is not already covered.

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

**Partial update — send only the fields you want to change; an omitted field
keeps its current value.** Editing `description` changes *when* the agent applies
the skill; editing `skill` changes *what it does* once applied.

## DELETE /{skill_id}
**Response 204:** No content

Deleting every skill does not disable the agent — it falls back to default
behaviour and its configured knowledge sources.

---

## Schemas

### BizAIOmniChannelSkillsRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | | Max 64 chars. Lowercase letters, numbers and hyphens only; must not start or end with a hyphen. Descriptive — `greeting-skill`, `product-return-policy`, never `skill-1` |
| description | string | | Max 1024 chars. WHEN to apply it. "Apply when the customer asks about returns or refunds" |
| skill | string | | Max 20000 chars. The actual instructions |

### BizAIOmniChannelSkillsResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Unique skill ID |
| title | string | | |
| description | string | | |
| skill | string | ✓ | The instruction body |
| channel | enum | ✓ | `email`\|`instagram`\|`line`\|`messenger`\|`sms`\|`tiktok`\|`unknown`\|`webchat`\|`whatsapp` |
| created_at | integer | | Unix timestamp |
| metadata | object (string values) | | Key-value pairs |
| **status** | enum | | **`active` \| `pending_review` \| `blocked`** — see below |

## Content review — a skill can be silently dead

`status` is new to our reading and is the field that matters most on screen.

- **`active`** — passed automated content review. The agent applies it.
- **`pending_review`** — review has not finished. A skill read back immediately
  after a create or update is *normally* in this state, so a UI that reads back
  straight after saving will usually see `pending_review`, not a problem.
- **`blocked`** — it failed review and **the agent never applies it**. Most often
  because the text asks for or refers to sensitive personal information. Editing
  the skill clears the block.

A blocked skill looks exactly like a working one everywhere in our product
today: saved, listed, no warning. The business owner believes the agent behaves a
certain way and it never will. **Nothing in our UI reads this field.**

## Conflicting skills

- Do NOT create two skills claiming priority for the same trigger.
- The agent cannot resolve the conflict → duplicate or inconsistent responses.
- Multiple actions on one trigger → one skill with an explicit sequence of steps.
- Each skill should describe a distinct situation; the agent matches a skill's
  stated conditions against the conversation.

## What changed since 2026-09-03

1. **`status` (`active` / `pending_review` / `blocked`) exists** and was not
   recorded. See above — this is a silent failure mode we do not surface.
2. **PUT is explicitly a partial update.** Previously the doc said only "Body:
   BizAIOmniChannelSkillsRequest" with no semantics. Anything that sends the
   whole object on every save is overwriting fields it may not have shown.

## Platform mapping (verified 2026-09-03)

- Create/update body: Java `SkillRequest.body` is sent to Meta as `"skill"`.
- Platform GET-by-id reads the local `agent_skill` row; there is no live Meta
  GET `/{skill_id}` in `AgentService.getSkill`.
- Writes use `MetaApiClient.scopedPath()` (`?agent_id=`).
- Title slug format is not validated server-side (TASK-043). The frontend does
  validate it, in two copied regexes — `SkillEditorModal.tsx:21` and
  `SkillEditPage.tsx:81` — while the create-agent wizard bypasses both by
  fabricating a title from `body.slice(0, 64)` (`StepSkills.tsx:146-150`), which
  produces titles Meta's own rule rejects.

## Error Codes
400 Bad request | 401 Unauthorized | 404 Not found | 429 Rate limited | 500 Server error
