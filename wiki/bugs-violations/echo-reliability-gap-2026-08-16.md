---
title: Message Echoes Stop Arriving Entirely — Unresolved — 2026-08-16
tags: [bug, webhook, bizai, meta-reliability, unresolved, critical, needs-meta-escalation]
date: 2026-08-16
status: open
---

# Message Echoes Stop Arriving Entirely — Unresolved

## What was found
Founder reported that in a real, live IndiaMART agent conversation (customer `6581830332`, `+91 91520 04195`), every single outbound (agent-sent) message displayed blank in the Inbox — not "Unrecognized," just an empty dash — including plain **text** replies, not just rich UI-Skill messages.

Traced via the app's own authenticated API (`GET /conversations/{id}/messages`, no direct DB access): all 14 outbound rows in that conversation have `content: null` AND `contentJson: null`, regardless of `contentType`. Cross-referenced against raw `webhook_raw` payloads for the same phone number and time window: **only `sent`/`delivered`/`read` status webhooks arrived for every outbound send in this conversation — zero `message_echoes` webhooks.**

This matters because Meta's BizAI generates and sends agent replies directly — this platform never calls a "send message" API itself. `message_echoes` is the *only* mechanism by which we ever learn what the AI actually said. If Meta doesn't send it, there is no other API or data source to recover the text from after the fact.

**Critically, this is not a permanent/architectural absence** — cross-checking the same account's broader webhook history (`GET /webhooks/raw?phoneNumberId=...`) found 7 real `message_echoes` payloads, full text intact, correctly parsed, from **earlier the same day** (2026-08-13 19:01–2026-08-14 03:24). Something caused Meta to stop sending echoes for this conversation specifically, starting around 2026-08-14 07:28 onward, with no code change or config change on our side in between.

## Why this is not a parsing bug
Unlike the two related findings from this same session ([[status-update-missing-standby-nesting-2026-08-16]], [[echo-parser-wrong-nesting-2026-08-13]]), there is no JSON shape to fix here — the webhook simply never arrives. `OutboundEchoParser` is correct and does capture the real echoes that do come in (verified against the 7 historical examples, full text bodies intact). This is a Meta-side delivery reliability question, not something fixable by better parsing on our end.

## What was tried
- Confirmed via raw payload inspection, not assumption, that no echo arrived (see above).
- Considered whether `agent_onboarding` (a separate open question from this session, see [[../sessions/session-2026-08-16|session note]]) might be a missing prerequisite that affects echo delivery — tested directly against Meta's API for an unrelated phone number and got a `500 Internal Server Error` there too, so it's not a usable fix either way. Not conclusively ruled in or out as related to echo delivery specifically.
- Meta Developer Tools MCP (`devtools_webhook_list` — lists topics/subscriptions actually configured on the app) was connected mid-session but not yet used to check whether this app's webhook subscription for this WABA/topic changed or degraded around the time echoes stopped. **This is the most promising next diagnostic step, not yet done.**

## Proposed interim fix (not yet built)
Since the text is genuinely unrecoverable when this happens, stop showing a bare, confusing blank/dash. Replace with an honest placeholder — e.g. "Message sent by AI — content not available" — so the UI reads as "something was sent but we don't have the text" rather than looking broken or empty.

## Open — needs next session
1. Use `devtools_webhook_list` (Meta Developer Tools MCP, connected this session) to check the actual webhook subscription/topic state for this WABA and see if anything changed.
2. Consider escalating to Meta/BSP support directly — echo delivery being reliable for hours and then silently stopping for the same agent, same day, with no error anywhere, is not documented behavior anywhere in `docs/meta-api/`.
3. Build the honest-placeholder UI fix regardless of root cause — it's needed either way.

## Related
- [[status-update-missing-standby-nesting-2026-08-16|StatusUpdateParser Missed the standby-Nested Shape]] — found the same day, different (shape) problem
- [[echo-parser-wrong-nesting-2026-08-13|Outbound Echo Parser Read the Wrong JSON Level]] — the original echo-parsing fix this builds on
- [[../sessions/session-2026-08-16|Session 2026-08-16]]
