---
title: AI Reply Text Never Persisted (Outbound Echo Not Parsed) — 2026-08-13
tags: [bug, webhook, conversations, bizai, critical, fixed]
date: 2026-08-13
---

# AI Reply Text Never Persisted (Outbound Echo Not Parsed)

## What was wrong
Founder report: "In Inbox, AI sent messages are not showing." This is the exact follow-up flagged (but not built) in [[bizai-active-messages-never-persisted-2026-08-13|BizAI-Active Customer Messages Never Persisted]] from earlier the same day.

Root cause in `ConversationService.processStatusUpdate()`: when a `sent` status webhook arrives for a BizAI-generated reply (Meta sends the reply itself; we never call our own send API for it), the code created an outbound `Message` row but hard-coded `content = null` — a status event carries no message text, only a message id and delivery state. So the row existed but rendered as an empty bubble in the Inbox thread.

The real reply text was available all along in a *different* webhook — `value.standby.message_echoes[]` — documented in `docs/meta-api/webhook-standby-handoff.md` and modeled by an already-created but never-wired `OutboundEcho` record. Nothing parsed it.

## The fix
- New `OutboundEchoParser` (mirrors `InboundMessageParser`/`StatusUpdateParser`) reads `value.standby.message_echoes[0]` into `OutboundEcho(metaMessageId, recipientPhone, textBody)`.
- New `ConversationStore.upsertOutboundEcho(...)`: the `sent`-status webhook and the echo webhook can arrive in either order, so this finds the existing row by `metaMessageId` and fills in the text if it's still null, or creates the row fresh if the echo arrived first.
- `ConversationService.processWebhookEvent` now also tries the echo parser (alongside the existing status-update check) whenever a payload isn't a customer-inbound message.
- Added `OutboundEchoParserTest` (4 cases: text echo, non-text echo with null body, no `message_echoes` present, malformed payload).

## Verification
- `mvn -q -o compile` — clean.
- `mvn -q -o test -Dtest=OutboundEchoParserTest` — 4/4 pass.
- `mvn -q -o package -DskipTests` — clean.
- Deployed to production: old jar backed up (`platform-0.1.0-SNAPSHOT.jar.bak-20260813T184656Z`), new jar byte-verified after scp (68770740 bytes both sides), service restarted, health check 200, `app.log` confirms clean startup ("Started PlatformApplication"), no Flyway migration involved (code-only change).

## Related
- [[bizai-active-messages-never-persisted-2026-08-13|BizAI-Active Customer Messages Never Persisted]] — the sibling inbound-side bug, fixed earlier the same day; this is its outbound-side counterpart
- `docs/meta-api/webhook-standby-handoff.md` — the source spec both fixes implement
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
