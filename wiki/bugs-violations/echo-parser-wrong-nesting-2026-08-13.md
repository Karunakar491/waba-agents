---
title: Outbound Echo Parser Read the Wrong JSON Level — 2026-08-13
tags: [bug, webhook, conversations, bizai, critical, fixed, echo-parsing]
date: 2026-08-13
---

# Outbound Echo Parser Read the Wrong JSON Level

## What was wrong
While demoing the IndiaMART agent's new Carousel/CTA UI skills, real WhatsApp replies stopped showing up in the Inbox — the agent looked completely silent to a real customer, even though `agent_test` calls were succeeding (just slow). Founder sent real messages from their own phone and pasted the actual WhatsApp transcript: BizAI was genuinely replying — "Hello again!... TMT bars in Delhi", a real supplier summary, and even a correct handoff trigger ("Let me connect you with a human IndiaMART representative"). **None of these replies existed in our own `Message` table for that conversation — zero outbound rows at all.**

Root cause: `OutboundEchoParser` (built earlier the same day to fix the sibling [[bizai-active-messages-never-persisted-2026-08-13|inbound standby bug]]) read `to`/`type`/`text.body` directly off `message_echoes[0]`. That shape was a guess, modeled on the inbound `messages[0]` shape — **never verified against a real echo payload**. A real echo payload, pulled from `webhook_raw` for this exact conversation, is nested one level deeper:

```json
"message_echoes": [{
  "id": "wamid...",
  "message": {
    "to": "918500996740",
    "type": "text",
    "text": { "body": "Let me connect you with a human IndiaMART representative for this." }
  },
  "timestamp": "..."
}]
```

`echoNode.path("to")` on the real shape always returns `""` (MissingNode → empty string), `type` always fell through to the `"unknown"` default, and since `type != "text"`, `textBody` was always `null` — so `processOutboundEcho` silently no-op'd (`if (echo.textBody() == null) return;`) on every single real echo. The webhook itself was received and persisted correctly (6 real echoes found in `webhook_raw` for this window) — the bug was entirely in the derived-Message-row parsing, not in webhook ingestion.

**Why the original unit test didn't catch this:** the test fixture used the same flat shape as the (wrong) implementation — it validated internal consistency, not correctness against real Meta traffic. Only caught by comparing a real WhatsApp transcript against what our own database had recorded for that same conversation.

## The fix
1. `OutboundEchoParser` now reads `to`/`type`/`text.body` from `echoNode.path("message")` (the real, confirmed shape).
2. **Defensive fallback added on top, per founder's explicit ask**: since Meta's webhook shapes have now proven inconsistent with our assumptions once, and there's no guarantee this is the *only* shape Meta ever sends (a different reply type, a different account tier, and — explicitly flagged as unverified — a human-handoff webhook may have its own distinct shape we haven't seen live yet), the parser tries the nested `message` shape first and falls back to reading straight off the echo node (the original flat guess) if `message` is absent, rather than silently dropping an unrecognized shape a second time.
3. Rewrote `OutboundEchoParserTest` with the real captured payload shape as the primary fixture; added a dedicated test for the flat-shape fallback path.

## Verification
- `mvn -q -o test -Dtest=OutboundEchoParserTest` — 5/5 pass (nested shape, non-text type, no-echo-present, malformed payload, flat-shape fallback).
- `mvn -q -o package -DskipTests` — clean.
- Deployed to production twice today (once for the path fix, once for the fallback) — old jar backed up + byte-verified scp + health-check each time, per Kill Switch discipline.
- Not yet re-verified against a fresh real WhatsApp message post-fix (founder was about to send one when this write-up started) — the next real message to the IndiaMART number should now show up correctly in the Inbox.

## Open, explicitly flagged — not guessed at
Human handoff may arrive via a webhook shape we have not yet seen live and cannot verify from inside this codebase. Per the "log every webhook" fix from earlier today, `webhook_raw` already persists every payload unconditionally regardless of whether any parser recognizes it — so nothing is silently lost at the storage layer even if a handoff shape doesn't match `HandoffClassifier`'s current assumptions. If handoff behavior looks wrong in a future session, check `webhook_raw` for the real payload shape before guessing — this is exactly the mistake that caused this bug in the first place.

## Related
- [[bizai-active-messages-never-persisted-2026-08-13|BizAI-Active Customer Messages Never Persisted]] — the sibling inbound-side bug this was built alongside
- [[outbound-echo-text-never-parsed-2026-08-13|AI Reply Text Never Persisted (Outbound Echo Not Parsed)]] — the same-day earlier fix that introduced the (wrong) shape assumption this entry corrects
- `docs/meta-api/webhook-standby-handoff.md` — should be updated with the real, verified `message_echoes` shape rather than the assumed one; not done in this pass, flagged as a follow-up
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
