# Meta Business Agent API — Index

Base domain: `https://api.facebook.com`
API Version header: `X-API-Version: 2.0.0`
Auth: `Authorization: Bearer {token}`
entity_id: WhatsApp Business Phone Number ID — **except `agent_budget`, where it
is the Business Manager ID.**

> Meta warns that `X-API-Version` is per-endpoint and does not necessarily match
> across the Business Agent APIs. `2.0.0` is correct for every endpoint
> documented here, but do not assume a single shared value for a new one.

---

## API Surface

| File | Base Path | Methods | Purpose |
|------|-----------|---------|---------|
| eligibility.md | `/{entity_id}/agent_eligibility` | GET | Check if phone number can use Meta Business Agent |
| agent-onboarding.md | `/{entity_id}/agent_onboarding` | POST | Trigger AI agent onboarding for entity+channel — creates entities, schedules async data-prep jobs |
| settings.md | `/{entity_id}/agent_config/settings` | GET, PUT | Enable/disable agent, handoff, followup, audience, never-say phrases. **PUT is a partial update.** Enabling needs billing unless audience is ALLOWLISTED_ONLY |
| agent-budget.md | `/{entity_id}/agent_budget` | GET, POST | Cap token / AI-turn usage per rolling window. **`entity_id` is the Business Manager ID, not the phone number ID.** Not implemented |
| business_info.md | `/{entity_id}/agent_config/business_info` | GET, PUT, DELETE | Business knowledge (payment/return/delivery/contact info) |
| allowlist.md | `/{entity_id}/agent_config/allowlist` | GET, POST, DELETE | Restrict agent to specific consumer phone numbers |
| skills.md | `/{entity_id}/agent_config/skills` | GET, POST, PUT, DELETE | Agent behavior instructions (tone, triggers, flows) |
| ui-skills.md | `/{entity_id}/agent-ui-skills` | GET, POST, PUT, DELETE | Rich-message components (2 carousels, CTA, reply buttons, flow, image, list, 2 location) — separate from plain text-instruction Skills. **The instruction carries the component's content.** PUT cannot change `component_type` |
| faq.md | `/{entity_id}/agent_config/faq` | GET, POST, PUT, DELETE | Q&A knowledge base |
| files.md | `/{entity_id}/agent_config/files` | GET, POST, DELETE | Document uploads (PDF, DOCX, images, CSV, XLSX) |
| websites.md | `/{entity_id}/agent_config/websites` | GET, POST, PUT, DELETE | URLs for agent to crawl |
| connectors.md | `/{entity_id}/agent_connectors` | GET, POST, PUT, DELETE + auth upserts + logs | External API integrations |
| connector-tools.md | `/{entity_id}/agent_connectors/{connector_id}/tools` | GET, POST, PUT, DELETE, run | Individual operations per connector |
| agent-eval.md | `/{entity_id}/agent-eval` | GET /cases, GET /details, GET /run, GET /summary, POST /run | Test and evaluate agent performance |
| agent-test.md | `/{entity_id}/agent_test` | POST | Send test messages, get agent response, multi-turn support (NOT billed) |
| delete-agent.md | `/{entity_id}/delete_agent` | DELETE | Remove agent from phone number, disconnects integration if last agent on account |
| agent-event.md | `/{entity_id}/agent_event` | POST, GET /{id} | Trigger agent from business events (payment, delivery, etc.) |
| thread-control.md | `/business/whatsapp/phone_numbers/{id}/thread_control` | POST | Move conversation control: `release` / `pass` / `take`. **`X-API-Version: 1.0.0`**, different base URL |
| conversation-insights.md | `/{entity_id}/insights/conversations` | GET | Conversations the agent handled over a range, and how many are waiting on a human right now. Not implemented |
| tool-call-insights.md | `/{entity_id}/insights/tool_calls` | GET | Per-tool volume, latency, success/error/timeout rates. Not implemented |
| conversation-turns.md | `/{entity_id}/insights/conversations/turns` | GET | Per-turn steps — every LLM and tool call with its own latency and status. **Attributes agent latency.** Not implemented |
| agent-event-insights.md | `/{entity_id}/insights/agent_events` | GET | Per-event-type volume, completion, latency. **Dates in Pacific Time, unlike the other insights.** Not implemented |
| troubleshooting.md | — | — | Meta's own error guide: status codes, connector failure codes, why agents go silent, `X-FB-Request-ID` |

---

## Where these come from — fetch them, do not wait to be sent them

**Meta's Business Agent docs are public and directly readable.** Confirmed
2026-09-24. Nobody needs to paste them in, and no page here is blocked on that.

The whole set is indexed machine-readably, and every page is served as markdown
by appending `.md`:

```
https://developers.facebook.com/documentation/meta-business-agent/llms.txt
```

| Our file | Meta's page (prefix `https://developers.facebook.com/documentation/meta-business-agent/`) |
|---|---|
| business_info.md | `reference/configure/agent-knowledge-business-info.md` |
| faq.md | `reference/configure/agent-knowledge-faqs.md` |
| files.md | `reference/configure/agent-knowledge-files.md` |
| websites.md | `reference/configure/agent-knowledge-websites.md` |
| agent-test.md | `reference/operate/agent-test.md` |
| skills.md | `reference/configure/agent-skills.md` |
| ui-skills.md | `reference/configure/ui-skills.md` |
| connectors.md | `reference/configure/connectors.md` |
| connector-tools.md | `reference/configure/connector-tools.md` |
| settings.md | `reference/onboard/agent-settings.md` |
| eligibility.md | `reference/onboard/agent-eligibility.md` |
| allowlist.md | `reference/onboard/agent-allowlist.md` |
| agent-onboarding.md | `reference/onboard/agent-onboarding.md` |
| agent-budget.md | `reference/configure/agent-budget.md` |
| delete-agent.md | `reference/delete-agent/delete-agent.md` |
| agent-eval.md | `reference/operate/agent-eval.md` |
| agent-event.md | `reference/operate/agent-event.md` |
| thread-control.md | `reference/operate/thread-control-cloud-api.md` |
| troubleshooting.md | `troubleshooting.md` |
| conversation-insights.md | `reference/insights/conversation-insights.md` |
| conversation-turns.md | `reference/insights/conversation-turns.md` |
| tool-call-insights.md | `reference/insights/tool-call-insights.md` |
| agent-event-insights.md | `reference/insights/agent-event-insights.md` |

**Pages Meta publishes that we have no file for at all:**
`capabilities.md`, `quickstart.md`, `get-started.md`, `get-api-key.md`,
`usage-guides/writing-ui-skills.md` (directly relevant to rich messages) and six
other `usage-guides/*` worked examples — booking, lead generation, customer
support, post-purchase support, and two purchase flows.

A pasted copy is still worth more than a fetch **when Meta's page and our
behaviour disagree** — a paste is dated evidence of what the page said on a day,
which is what settled the `instruction` argument on 2026-09-24. Fetch to refresh;
keep a paste when it is being used to prove something.

## Freshness — which of these match Meta's current docs

The founder supplied refreshed official docs on **2026-09-22**. The five that
paste did not cover were fetched from Meta on **2026-09-24**, so nothing in this
directory is stale on a date any more.

"Refreshed (fetched)" means read from Meta's own page by this agent.
"Refreshed" alone means read from a copy the founder supplied — dated evidence
of what the page said that day, which is stronger when our behaviour and Meta's
page disagree.

| File | State |
|------|-------|
| eligibility.md | **Refreshed 2026-09-22** — no reason given on failure, not permanent, error ≠ ineligible |
| agent-onboarding.md | **Refreshed 2026-09-22** — `catalog_id` body; `channel` param discrepancy flagged, unresolved |
| settings.md | **Refreshed 2026-09-22** — billing gate, PUT is partial, `never_say_phrases`, `message_selection`, `handoff.enabled` meaning now disputed |
| allowlist.md | **Refreshed 2026-09-22** — 20-entry cap, 1,000/hr per operation, V2 schemas, Instagram |
| delete-agent.md | **Refreshed 2026-09-22** — verified identical, no change |
| thread-control.md | **Refreshed 2026-09-22** — `pass` and `take` are real, `control_pass`, `metadata` |
| agent-event.md | **Refreshed 2026-09-22** — V2 schema, Instagram is synchronous, consumer must already have a conversation |
| agent-budget.md | **New 2026-09-22** — not implemented |
| agent-eval.md | **Refreshed 2026-09-22** — verified accurate; added `scenario_version` |
| conversation-insights.md | **New 2026-09-22** — not implemented |
| tool-call-insights.md | **New 2026-09-22** — not implemented |
| conversation-turns.md | **New 2026-09-22** — not implemented |
| agent-event-insights.md | **New 2026-09-22** — not implemented |
| troubleshooting.md | **New 2026-09-22** |
| agent-test.md | **Refreshed 2026-09-24 (fetched)** — schema was already complete; rate limits 500/hr per number and 10,000/hr per app are new, plus 404. Not billed, no consumer number needed, and unused by us |
| business_info.md | **Refreshed 2026-09-24 (fetched)** — schema unchanged. PUT overwrites only *provided* fields, so `""` overwrites and an absent field does not; `contact_info` is null when unconfigured; Instagram scope added |
| skills.md | **Refreshed 2026-09-24** — `status` (`active`/`pending_review`/`blocked`) is new and unsurfaced; PUT is a partial update |
| ui-skills.md | **Refreshed 2026-09-24** — ninth type `interactive_reply_buttons`; the instruction carries the component's CONTENT, not just the trigger; PUT takes only title/status/instruction |
| faq.md | **Refreshed 2026-09-24 (fetched)** — schema verified unchanged; 409 Conflict was missing, and our add path saves locally on any error, so a 409 strands an FAQ Meta will never accept |
| files.md | **Refreshed 2026-09-24 (fetched)** — Meta checks file content against the extension in `file_name`; 409 and 503 were missing; max is 100,000,000 bytes decimal, not 100 MiB |
| websites.md | **Refreshed 2026-09-24 (fetched)** — **five writable fields we never offer** (single_urls, include/exclude sub-domains and URL patterns); `crawl_status` has six values not four (`not_started`, `completed_no_data`); `crawl_error` exists and is unread |
| connectors.md | **Refreshed 2026-09-22** — MCP protocol + `refreshMCPTools` (fails as HTTP 200), `mcp_tool_sync`, unique-name 409, 7-day log retention |
| connector-tools.md | **Refreshed 2026-09-22** — macros 3 → 10, `transformation_spec` (new; its per-kind params truncated in the paste) |
| webhook-standby-handoff.md | Observed traffic, not an official doc. Now conflicts with `troubleshooting.md` on `messaging_handovers` |

---

## Setup Sequence (correct order)

```
1. GET  /agent_eligibility          → verify phone number is eligible
2. POST /agent_onboarding           → provision the agent, capture agent_id
3. PUT  /agent_config/settings      → create agent (disabled)
4. POST /agent_config/skills        → configure behavior/tone
5. POST /agent_config/faq           → add knowledge (Q&A)
6. POST /agent_config/files         → add knowledge (documents)
7. POST /agent_config/websites      → add knowledge (URLs to crawl)
8. POST /agent_connectors           → connect external APIs
9. POST /agent_connectors/{id}/tools → define connector operations
10. PUT /agent_config/settings      → enable agent (rollout.enabled = true)
11. POST /agent-eval/run            → run evaluation before going live
```

> **Step 2 was missing from this list and that cost a week.** Meta's published
> sequence still starts at eligibility → settings, but `troubleshooting.md`
> states plainly that connector calls return `400` until onboarding has been
> called for that phone number, and the 2026-08-25..09-01 outage was exactly
> this (`TASKS.md` #15). Onboarding is not optional.

> **Step 10 needs billing.** `rollout.enabled = true` requires a payment method
> on the Business Agent account unless `ai_audience` is `ALLOWLISTED_ONLY`.
> Without one the agent can be enabled but delivers nothing. See `settings.md`.

---

## Key Design Facts

- `entity_id` is the **WhatsApp Business Phone Number ID** — except `agent_budget`, where it is the **Business Manager ID**
- Settings `PUT` is a **partial update** — omitted fields keep their current value. *(Corrected 2026-09-22; this line previously said "full replace — send all fields every time", which was wrong.)*
- Disabling agent stops responses to ALL threads — re-enabling only picks up NEW threads
- **Sending any message from our app takes thread control and silences the agent** until `release` is called. Meta names this as the common cause of agents that work in testing and go silent in production.
- **Enabling the agent for `EVERYONE` requires a payment method.** `ALLOWLISTED_ONLY` (max 20 consumers) does not, and is the supported way to test before billing exists.
- **Omitting `X-API-Version` resolves to the oldest version the endpoint supports**, silently — not an error. The value is per-endpoint.
- **A `200` with an empty body often means a missing `whatsapp_business_management` permission**, not absent data.
- Every response carries `X-FB-Request-ID` (and `fbtrace_id` in error bodies) — the fastest way for Meta support to find a failed call. We log neither.
- Skills: conflicting skills on same trigger → agent produces inconsistent responses — consolidate
- **A skill can come back `blocked` by Meta's automated content review and is then never applied.** `pending_review` right after a save is normal; `blocked` is not, and editing the text clears it. Nothing in our UI reads this (`skills.md`)
- **A UI skill's `instruction` must contain the component's own content** — body text, button labels, URLs. There is no other field for them (`ui-skills.md`)
- FAQ answers must be self-contained — agent retrieves each entry independently
- Connector tools: always provide `description` on every param node — agent extracts values from conversation using descriptions
- `ai_audience`: WhatsApp **and Instagram**. `EVERYONE` (default) or `ALLOWLISTED_ONLY`
- Supported channels: email, instagram, line, messenger, sms, tiktok, webchat, whatsapp

---

## Auth Types for Connectors

| Type | When to use |
|------|-------------|
| `OAUTH2_CLIENT_CREDENTIALS` | Machine-to-machine OAuth |
| `API_KEY` | Static API key in header/query/body |
| `NONE` | No auth (public APIs) |
| `OAUTH2`, `BASIC`, `CUSTOM` | Defined but NOT currently supported |

---

## Still Missing (paste when available)
- [x] Onboarding API — see `agent-onboarding.md`. Implemented in `AgentService.bindPhone()` when `metaAgentId == null` (verified 2026-09-03). Bind order: eligibility GET → onboarding POST → settings PUT.
- [x] Business Info API — see `business_info.md` (2026-08-04; implementation already existed via BusinessProfileDeployService, doc was just never backfilled until now)
- [x] UI Skills API — see `ui-skills.md`. Implemented 2026-08; see `ui-skills.md` Implementation Note (2026-09-03).
- [x] Webhook payload schemas (messages, standby) — see `webhook-standby-handoff.md`. No `messaging_handovers` field observed in real traffic; handoff signal is standby-wrapper presence/absence instead.
