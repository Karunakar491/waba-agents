---
title: BizAI-Active Customer Messages Never Persisted to Conversations — 2026-08-13
tags: [bug, webhook, conversations, bizai, critical, fixed]
date: 2026-08-13
---

# BizAI-Active Customer Messages Never Persisted to Conversations

## What was wrong
Founder texted "Hi" to the live, active IndiaMART Buyer Discovery Agent and it never appeared in the Conversations/Inbox tab. Traced live against production (SSH to the app server, real `app.log`, real API calls via the app's own login — no direct DB access):

1. Nginx access log showed the webhook POST arriving and getting a 200.
2. `app.log` showed it correctly attributed to the right agent (`WebhookListener` → `ConversationService.processWebhookEvent`), but every single one logged `BizAI active on webhook: id=... — observability only, no action taken` and nothing else — no `Message`/`Conversation` row was ever created.
3. Root cause in `InboundMessageParser.parse()`: it only ever reads `/entry/0/changes/0/value/messages/0`. Per `docs/meta-api/webhook-standby-handoff.md` (captured from real partner traffic, not generic Meta docs), when Meta's own AI (BizAI) is actively responding to a conversation — i.e. **every normal, live, deployed agent** — the customer's real message is nested one level deeper, under `value.standby.messages[0]`, not the top-level path. `HandoffClassifier` already reads this exact `standby` key to detect the `BIZAI_ACTIVE` signal, but nothing ever extracted the message itself from inside it.

This is not a rare edge case — it is the *normal* case for the entire product. Any agent Meta's AI is actually answering (the whole point of this platform) had its customer messages silently dropped from the Conversations tab, every time, since this webhook pipeline was first built.

## The fix
`InboundMessageParser.parse()` now falls back to `/entry/0/changes/0/value/standby/messages/0` when the top-level path is missing, before giving up. No other change needed: `ConversationService.processWebhookEvent` already handles the resulting `InboundMessage` correctly — `saveInbound` persists it, and the existing `signal == HandoffSignal.NEEDS_HUMAN` check (false for `BIZAI_ACTIVE`) already correctly skips marking the conversation as needing a human, since Meta's AI is genuinely handling it. Added `should_parse_message_nested_under_standby_when_bizai_is_active` to `InboundMessageParserTest`.

## What's still NOT captured (explicit, not silently dropped)
BizAI's own actual reply text lives in a *different* shape again — `value.standby.message_echoes[]` (an outbound echo of what Meta's AI actually said), not `value.standby.messages[]`. This fix only recovers the customer's inbound side. The Conversations tab will now show what the customer said, but not yet what the AI replied with — that's a real, separate follow-up (parsing `message_echoes` as an outbound `Message` row), not started here.

**Update 2026-08-13 (same day):** this follow-up is now done — see [[outbound-echo-text-never-parsed-2026-08-13|Outbound Echo Text Never Parsed]].

## Verification
- New unit test passes: `mvn -q -o test -Dtest=InboundMessageParserTest` (the one pre-existing failure, `should_return_non_text_placeholder_when_message_type_is_image`, was confirmed via `git show HEAD:...` to already be broken in committed code before this session — unrelated, not caused by this change).
- `mvn -q -o package -DskipTests` — built clean.
- Deployed to production: jar byte-verified after scp (local/remote size match), old jar backed up (`platform-0.1.0-SNAPSHOT.jar.bak-20260813T100926Z`), service restarted, clean startup confirmed in `app.log` ("Started PlatformApplication"), confirmed reachable via a real login call through the app's own API post-deploy.

## Related
- `docs/meta-api/webhook-standby-handoff.md` — the source spec this fix implements
- [[../decisions/indiamart-buyer-discovery-agent-2026-08-13|IndiaMART Buyer Discovery Agent]] — the agent this was found on
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
