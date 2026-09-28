# UI Skills API
Base URL: `https://api.facebook.com/{entity_id}/agent-ui-skills`

> **Source of record:** the official page as supplied by the founder on
> 2026-09-24 is kept verbatim at
> [`sources/2026-09-24-ui-skills-official.md`](sources/2026-09-24-ui-skills-official.md).
> It wins over this summary if the two ever disagree.


entity_id = WhatsApp Business Phone Number ID

Auth: `Authorization: Bearer {token}` | `X-API-Version: 2.0.0`
Required: `whatsapp_business_messaging`

**Refreshed 2026-09-24** from the official spec supplied by the founder. Three
things changed since the 2026-09-03 reading — see *What changed* at the bottom.

Note: separate surface from the plain **Skills API** (`agent_config/skills`,
text-instruction skills). A UI skill tells the agent when and how to send one
RICH MESSAGE component — a CTA URL button, an image, a carousel, an interactive
list, reply buttons, a location, or a WhatsApp Flow.

## The instruction carries the CONTENT, not just the trigger

This is the field most easily got wrong. `instruction` must tell the agent
**when** to send the component **and contain every value the component needs**.
The fields differ per component type, and there is nowhere else to put them —
there is no body, no media field, no button array on this API.

Meta's own example for `cta_url`:

> If a user asks for a link to learn more about the Meta Quest, please send them
> a button with body text "Click the link below", button label text "Meta Quest",
> and URL https://meta.com/quest

So the UI must ask for a paragraph that names the text, the labels and the URLs —
not a one-line "when to send this" note. Which values each type needs is in
Meta's per-component message docs:

| component_type | Fields it needs — Meta's reference |
|---|---|
| `cta_url` | Interactive CTA URL button messages |
| `image` | Image messages |
| `interactive_list` | Interactive list messages |
| `interactive_reply_buttons` | Interactive reply buttons messages |
| `location` | Location messages |
| `location_request` | Location request messages |
| `carousel_url`, `carousel_quick_reply` | Media carousel messages |
| `flow` | attached by `flow_id`, not by instruction text |

Meta also publishes a *Writing UI skills* usage guide under
`developers.facebook.com/documentation/meta-business-agent/usage-guides/writing-ui-skills`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | List all UI skills (paginated: `before`/`after`/`limit`) |
| POST | / | Create a new UI skill |
| GET | /{instruction_id} | Get a specific UI skill |
| PUT | /{instruction_id} | Update a specific UI skill |
| DELETE | /{instruction_id} | Delete a specific UI skill |

---

## GET /
**Query params:** `before`, `after` (cursors), `limit`
**Response 200:** `{ data: BizAIOmniChannelUISkillResponse[], paging: Paging }`

Meta's own warning on `limit`: a page may return fewer than `limit` because of
privacy filtering, and an empty page may still carry a `next` link. **Stop
paging when `next` is absent — never when a page is short or empty.**

## POST /
**Body:** `BizAIOmniChannelUISkillCreateRequest`
**Response 201:** `BizAIOmniChannelUISkillResponse`

## GET /{instruction_id}
**Response 200:** `BizAIOmniChannelUISkillResponse`

## PUT /{instruction_id}
**Body:** `BizAIOmniChannelUISkillUpdateRequest`
**Response 200:** `BizAIOmniChannelUISkillResponse`

## DELETE /{instruction_id}
**Response 204:** No content

---

## Schemas

### BizAIOmniChannelUISkillCreateRequest
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | ✓ | Human-readable name. **No format rule** — unlike plain Skills, this is not a slug |
| component_type | enum | ✓ | `carousel_quick_reply` \| `carousel_url` \| `cta_url` \| `flow` \| `image` \| `interactive_list` \| **`interactive_reply_buttons`** \| `location` \| `location_request` |
| status | enum | ✓ | `disabled` \| `enabled` |
| instruction | string | ✓ | When to send it **and every value it needs** — see above |
| flow_id | integer | | Required when `component_type=flow`; **rejected for every other type** |

### BizAIOmniChannelUISkillUpdateRequest
**Only three fields, and `component_type` is not one of them.**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | | |
| status | enum | | `disabled` \| `enabled`. **Flow skills cannot be enabled unless the corresponding flow is published** |
| instruction | string | | |

A UI skill's component type is fixed once created. Changing it means delete and
recreate. Anything that sends `component_type` on a PUT is sending a field the
API does not accept.

### BizAIOmniChannelUISkillResponse
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | |
| title | string | ✓ | |
| component_type | enum | ✓ | nine values, as above |
| status | enum | ✓ | `disabled` \| `enabled` |
| instruction | string | ✓ | |
| flow_id | integer | | Only present for flow skills |
| created_at | integer | ✓ | Unix timestamp |
| updated_at | integer | ✓ | Unix timestamp |

### Paging
`paging.cursors.{before,after}`, `paging.{previous,next}`. Stop when `next` is
absent.

---

## What changed since 2026-09-03

1. **`interactive_reply_buttons` is a ninth component type.** We do not support
   it anywhere — it is missing from all four of our component lists.
2. **The instruction carries the component's content.** Our editors describe it
   as "tells the agent WHEN to send this", and `UiSkillEditorModal.tsx:20-25`
   states in a comment that "the component's own content lives elsewhere on
   Meta". That is wrong: there is nowhere else. A user following our labels
   writes a trigger with no body text, no button label and no URL, and the
   component cannot be built.
3. **PUT takes only `title`, `status` and `instruction`.** Previously recorded
   as "same fields as Create, all optional".

## Platform mapping (verified 2026-09-03, still true)

Do not "fix" Meta; this records our divergence.

- `AgentController` `/api/v1/agents/{id}/ui-skills` → `AgentService.addUiSkill` /
  `getUiSkills` / `getUiSkill` / `updateUiSkill` / `deleteUiSkill`. Table
  `agent_ui_skill` (`AgentUiSkill`).
- `component_type=flow` and `flow_id` are **excluded** from
  `AgentUiSkill.ComponentType` (intentional — Flows are out of scope).
- Platform never proxies Meta's paginated GET list; reads the local DB only.
- Platform PUT is a **full replace** of title/componentType/status/instruction.
  Meta's PUT does not accept `componentType` at all, so this is not merely a
  semantic difference — we send a field the API rejects or ignores.
- UI-skill Meta paths are **not** `agent_id`-scoped, unlike `agent_config/skills`.

## Frontend mapping — found and fixed 2026-09-24

All of these are fixed. The single source is
`frontend/src/components/skills/uiComponentTypes.ts`.

- The wizard rendered the raw enum values as the words a business owner reads
  (`carousel_quick_reply`, `location_request`). **Fixed** — plain-English labels
  everywhere.
- The chip labelled "Carousel" mapped to `carousel_url` alone, so the
  reply-button carousel was unreachable, as was `image`. **Fixed** — the chips
  are now every type we offer, derived from the one list.
- A "Flow" chip and a dead "Flow" select were drawn for a type we do not
  support. **Fixed** — both removed. A control for something we cannot do is an
  advertisement, not an explanation.
- `interactive_reply_buttons` was missing entirely. **Fixed** — offered as
  "Reply buttons".
- The instruction field was labelled "when should this send?" and the editor
  claimed the content "lives elsewhere on Meta". **Fixed** — it now reads "When
  to send it, and what it should say", carries a per-type line naming exactly
  what that type needs, and every placeholder is a worked example including the
  text, labels and URLs.
- The component-label map existed in four copies, which is how the wizard's
  drifted. **Fixed** — one module, imported by all four.
- The editor let someone change `component_type` on an existing rich message,
  which Meta's update does not accept. **Fixed** — locked once created, and it
  says why.

**Correction to an earlier note in this file.** It claimed the chip form
"always posts `status: 'enabled'`, so a rich message goes live with no review".
The first half is true, the conclusion was not: inside agent creation the agent
is not deployed until the final step, so nothing reaches a customer in the
meantime. Left as it is.

Still open: our platform PUT sends `componentType` to Meta, which the update
endpoint does not accept. That is a backend change and was not made here.

## Error Codes
400 Bad request | 401 Unauthorized | 403 Forbidden | 404 Not found | 429 Rate limited | 500 Server error
