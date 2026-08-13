# Webhook Standby/Handoff Signal — Observed Partner Payloads

Source: partner sample payloads captured during pilot, Jul 11–14, 2026 (real webhook traffic, not generic Meta docs). Supersedes the `messaging_handovers` field description in `thread-control.md` — that field was never observed in practice.

## The real signal: `standby` wrapper presence, not a separate field

| Scenario | Shape | `field` value | Meaning |
|---|---|---|---|
| BizAI sends a message (its own outbound, echoed to us) | `value.standby.message_echoes[]` | `"standby"` | Observability only — BizAI is active and handling this conversation |
| Consumer message arrives **while BizAI is responding** | `value.standby.contacts[]` + `value.standby.messages[]` | `"standby"` | BizAI is in control, no action needed from us |
| Consumer message arrives and **BizAI does NOT respond** | `value.contacts[]` + `value.messages[]` (top-level, no `standby` wrapper) | `"messages"` | **This is the handoff moment** — Meta is not handling it, we are |
| Status webhooks (sent/delivered/read) | `value.statuses[]`, no `contacts`/`messages` | `"messages"` | Unrelated to handoff — normal delivery receipts, always this shape regardless of standby state |

## Parsing rule for the webhook controller

```
if value.standby exists  → BizAI active, log/observe only, do not mark needs_human
else if value.messages exists AND value.statuses does NOT exist → handoff occurred, mark conversation needs_human
else if value.statuses exists → normal status webhook, existing status-processing path (no change)
```

## Why this matters
- No `messaging_handovers` field to listen for — don't build a parser branch looking for it, it won't appear.
- The distinguishing check is structural (is `messages` nested under `standby`, or is it top-level), not a field-name check.
- `biz_opaque_callback_data: {"originator":"bizai","channel":"ent"}` appears on BizAI-originated echoes — useful for confirming a message's origin during debugging, not required for the handoff branch itself.

## `message_echoes[]` real shape (verified 2026-08-13 against live traffic)
The row above only says the echo lives at `value.standby.message_echoes[]` — it does NOT say what's inside one. That was guessed once (flat: `{to, id, type, text}` directly on the array element) and the guess was wrong, silently dropping every real BizAI reply for hours before being caught. The real, confirmed shape nests the actual message one level deeper, under a `message` key:

```json
"message_echoes": [{
  "id": "wamid.HBgMOTE4NTAwOTk2NzQwFQIAERgSOUNBQzZCNzhCMzg3MjcwNjlBAA==",
  "message": {
    "to": "918500996740",
    "text": { "body": "Let me connect you with a human IndiaMART representative for this.", "preview_url": "true" },
    "type": "text",
    "recipient": "IN.26874087912280326",
    "recipient_type": "individual",
    "biz_opaque_callback_data": "{\"originator\":\"bizai\",\"channel\":\"ent\"}"
  },
  "timestamp": "1786647759"
}]
```

`id` is on the echo entry itself; `to`/`type`/`text.body`/`recipient`/`recipient_type`/`biz_opaque_callback_data` are all under `message`. See [[../../wiki/bugs-violations/echo-parser-wrong-nesting-2026-08-13|the incident this shape correction came from]] for the full story — real customer replies were sent but never persisted because of the wrong assumption.

## Open items
- Full webhook payload schemas (messages, standby) are now available via this pilot capture — `docs/meta-api/INDEX.md` "Still Missing" list should be updated to remove this item.
- **Human handoff's own webhook shape is still unverified against real traffic** (whatever payload arrives at the moment BizAI actually hands off to a human, as opposed to the `standby`-absent inference this doc already documents). Given `message_echoes[]`'s shape was wrong on first guess, do not assume any related shape is correct until checked against a real captured payload in `webhook_raw` — the table persists every payload unconditionally regardless of whether any parser recognizes it, so the real shape is always retrievable when it actually occurs.
