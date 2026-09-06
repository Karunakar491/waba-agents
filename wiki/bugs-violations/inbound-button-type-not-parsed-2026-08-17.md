---
title: Inbound button-type Messages Not Parsed
tags: [bug, webhooks, parser, inbox, unresolved]
date: 2026-08-17
status: open
---

# Inbound button-type Messages Not Parsed

## Context
Founder shared three real Meta example webhook payloads to verify which fields need subscribing (`standby` vs `messages`). One example — a consumer tapping a quick-reply/CTA button while BizAI is in standby — was `type: "button"`, not `text` or `interactive`.

## Bug
[`InboundMessageParser.java:49-63`](../../backend/src/main/java/com/metaagent/platform/domain/conversation/service/InboundMessageParser.java#L49-L63) only extracts a readable `textBody` for `type == "text"` (from `text.body`) or `type == "interactive"`. For `type == "button"`, neither branch matches, so `textBody` stays `null`.

Real shape for this type:
```json
{
  "type": "button",
  "button": { "payload": "26924503467252728", "text": "I'm interested" }
}
```

## Impact
The message is still persisted in full via `contentJson` (the "no silent drops" invariant holds), but the Inbox conversation view would show a blank/unreadable entry for any consumer button tap arriving during standby — the same class of problem as the 2026-08-13 echo-nesting bugs, just for a different message type and a different field.

## Fix (not yet applied)
Add a `"button".equals(type)` branch to `InboundMessageParser`, extracting `button.text` (fall back to `button.payload` if text is absent) into `textBody`.

## Related
- [[../sessions/session-2026-08-17|Session 2026-08-17]] — where this was found
- [[echo-parser-wrong-nesting-2026-08-13|Outbound Echo Parser Read the Wrong JSON Level]] — same "unhandled real shape" pattern
- [[status-update-missing-standby-nesting-2026-08-16|StatusUpdateParser Missed the standby-Nested Shape]] — third prior instance of this class of gap
