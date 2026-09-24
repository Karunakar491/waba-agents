# SOURCE — Agent Skills, official Meta documentation

**Supplied by the founder 2026-09-24**, pasted verbatim below except for the
per-endpoint error tables (400/401/404/429/500 → `StandardError`), which repeat
identically on every endpoint and are recorded once at the bottom.

This file is evidence of what the page said on this date. `../skills.md` is our
working summary; where the two disagree, **this one wins**.

---

## Agent Skills

Manage AI agent skills for a specific entity (WhatsApp Business Phone Number).

This endpoint provides CRUD operations for managing AI agent skills for a
specific entity (WhatsApp Business Phone Number). Skills define behavioral
guidelines, tone of voice, and response patterns for the AI agent. The agent
follows skills as written, so write them as clear directives. Avoid conflicting
skills — if two skills both claim priority for the same situation (e.g., both
say "do this first" when a customer messages), the agent may produce duplicate
or inconsistent responses. When multiple actions should happen on the same
trigger, consolidate them into a single skill with explicitly ordered steps.

**Base URL:** `https://api.facebook.com/{entity_id}/agent_config/skills`

**Authorization** — any of:
- Capability: `bizai_wa_enterprise_api_3p_access`
- Capability: `bizai_ig_enterprise_api_3p_access`
- Permission: `whatsapp_business_messaging`

Header: `X-API-Version: "2.0.0"` (not required).
`entity_id` — the WhatsApp Business Phone Number ID, Instagram business account
ID, or Instagram username for the Meta Business Agent.

## Endpoints

| Method | Endpoint |
|--------|----------|
| DELETE | `/{skill_id}` |
| GET | `/` |
| GET | `/{skill_id}` |
| POST | `/` |
| PUT | `/{skill_id}` |

### DELETE /{skill_id}
Delete a skill by its ID. The agent stops applying it. Deleting every skill does
not disable the agent. It falls back to its default behavior and its configured
knowledge sources. **204** on success.

### GET /
Retrieve every skill configured for the specified entity. The response is the
agent's full behavioral configuration, so read it before creating a skill to
check that the situation you are targeting is not already covered by an existing
one. Query: `agent_id` (optional settings ID; when absent, the most recently
created settings for the channel). **200** → array of
`BizAIOmniChannelSkillsResponse`.

### GET /{skill_id}
Retrieve a single skill by its ID, including the conditions under which it
applies and the instructions it gives the agent. `skill_id` is a UUID.

### POST /
Create a skill for the agent. A skill is a named, scoped instruction that tells
the agent how to behave in a particular situation: the `description` field
states when the skill applies, and the `skill` field states what the agent
should do once it applies. The agent evaluates the entity's skills against the
conversation and applies the ones whose stated conditions match, so each skill
should describe a distinct situation. Skills replace the instructions resource
used in API version 1.0.0. Query: `agent_id` (optional). **201** on success.

### PUT /{skill_id}
Update a skill by its ID. **Send only the fields you want to change. Any field
you omit keeps its current value.** Editing the `description` changes when the
agent applies the skill; editing the `skill` body changes what it does once
applied. **200** on success.

## Schemas

### BizAIOmniChannelSkillsRequest

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| title | string | | A human-readable name for the skill. Max 64 characters. Must contain only lowercase letters, numbers, and hyphens, and must not start or end with a hyphen. Use a descriptive title that makes the skill's purpose clear (e.g., `greeting-skill`, `product-return-policy`). Avoid generic titles like `skill-1`. |
| description | string | | A description telling the AI when to apply this skill. Max 1024 characters. Be specific about the trigger or context — for example, "Apply when the customer first messages the agent" or "Apply when the customer asks about returns or refunds." The agent uses this to decide which skills are relevant to the current conversation. |
| skill | string | | The body containing the actual instructions for the AI. Max 20000 characters. Write clear, non-conflicting directives. Avoid having multiple skills that each claim priority for the same situation (e.g., two skills that both say "do this first" on the first message) — the agent cannot resolve conflicting priorities and may produce duplicate or inconsistent responses. If multiple actions should happen on the same trigger, consolidate them into a single skill with an explicit sequence of steps. |

### BizAIOmniChannelSkillsResponse

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | ✓ | A unique identifier for the skill |
| title | string | | An optional, human-readable name for the skill |
| description | string | | A description telling the AI when to apply this skill |
| skill | string | ✓ | The body containing the actual instructions for the AI. Has no specific restrictions on structure or content. |
| channel | enum | ✓ | One of `email`, `instagram`, `line`, `messenger`, `sms`, `tiktok`, `unknown`, `webchat`, `whatsapp` |
| created_at | integer | | The timestamp when the skill was created |
| metadata | Metadata | | A map of key-value pairs for additional metadata (additional properties: string) |
| status | enum | | One of `active`, `pending_review`, `blocked`. Whether the agent is applying this skill. `active` means the skill passed the automated content review. `pending_review` means the review has not finished yet; a skill read back immediately after a create or update is normally in this state. `blocked` means the skill did not pass the review and **the agent never applies it** — most often because the text asks for or refers to sensitive personal information. Edit the skill to clear the block. |

### StandardError

| Property | Type | Required |
|----------|------|----------|
| title | string | ✓ |
| detail | string | ✓ |
| type | string | |
| status | integer | |

Every endpoint returns `StandardError` for 400, 401, 404 (where applicable),
429 and 500.

## Authentication

`OAuthToken__Authorization` — HTTP Bearer, header `Authorization: Bearer <token>`.
Required on all endpoints.
