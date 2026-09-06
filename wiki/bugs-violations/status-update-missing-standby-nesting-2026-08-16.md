---
title: StatusUpdateParser Missed the standby-Nested Shape — 2026-08-16
tags: [bug, webhook, conversations, bizai, fixed, verify-real-traffic, third-instance]
date: 2026-08-16
---

# StatusUpdateParser Missed the standby-Nested Shape

## What was wrong
Founder pasted a real webhook payload from the Webhooks tab showing a `delivered` status update, but the UI displayed it as "Unrecognized." Root cause: `StatusUpdateParser` only ever read `/entry/0/changes/0/value/statuses/0` — but for BizAI-owned conversations, Meta nests the exact same status object one level deeper, under `value.standby.statuses[0]`, e.g.:

```json
{"changes": [{"field": "standby", "value": {"standby": {
  "statuses": [{"id": "wamid...", "status": "delivered", "recipient_id": "919348168186"}]
}}}]}
```

This is the **same shape family** as two earlier bugs this project already hit: inbound `messages` nested under `standby` ([[bizai-active-messages-never-persisted-2026-08-13]]), and outbound `message_echoes` read from the wrong nesting level ([[echo-parser-wrong-nesting-2026-08-13]]). Both of those were fixed by handling the `standby`-nested path — but `StatusUpdateParser` was never updated with the same fix, even though it parses a structurally identical field.

**Impact was worse than a UI label**: this wasn't just a display bug. `StatusUpdateParser` returning empty for these payloads means the actual processing pipeline (`ConversationService.processStatusUpdate`) never ran for them either — every delivery-status update (`sent`/`delivered`/`read`/`failed`) for a BizAI-owned conversation was silently dropped server-side, not just mislabeled client-side.

## The fix
- Backend: `StatusUpdateParser.parse()` now falls back to `/entry/0/changes/0/value/standby/statuses/0` when the top-level path is missing — mirrors the exact pattern already used for inbound messages and outbound echoes.
- Added a unit test (`should_parse_status_nested_under_standby`) using the real captured shape as the fixture, not a guess.
- Frontend: `webhookSummary.ts`'s `summarizeWebhookPayload()` gained the same `value.standby?.statuses?.[0]` fallback, so the Webhooks tab shows "Status"/"Delivered" instead of "Unrecognized" for these rows too.

## Why this is the standing lesson's third confirmed instance
Three separate parsers (`InboundMessageParser`, `OutboundEchoParser`, `StatusUpdateParser`) have now each independently missed a `standby`-nested Meta webhook shape, on three different days, each caught only by inspecting real traffic rather than by re-reading the docs. The lesson from [[echo-parser-wrong-nesting-2026-08-13]] — "log everything, don't assume any related webhook shape is correct until checked against real captured traffic" — should now be read as "don't assume a `standby` fallback exists on parser N+1 just because it was added to parsers 1..N — check each one explicitly." Every future parser touching a webhook payload should be grepped against the others for this pattern before being declared complete.

## Verification
- `./mvnw -Dtest=StatusUpdateParserTest test` — 9/9 pass.
- `npx tsc --noEmit` — clean.
- Deployed to production same day (jar + frontend build, byte-verified transfer, clean `Started PlatformApplication` in `app.log`).

## Related
- [[bizai-active-messages-never-persisted-2026-08-13|BizAI-Active Customer Messages Never Persisted]] — first instance, inbound `messages`
- [[echo-parser-wrong-nesting-2026-08-13|Outbound Echo Parser Read the Wrong JSON Level]] — second instance, outbound `message_echoes`
- [[echo-reliability-gap-2026-08-16|Message Echoes Stop Arriving Entirely — Unresolved]] — related, but a genuinely different problem (Meta not sending the webhook at all, vs. sending it in an unhandled shape)
- [[../sessions/session-2026-08-16|Session 2026-08-16]]
