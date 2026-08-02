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

## Open item
Full webhook payload schemas (messages, standby) are now available via this pilot capture — `docs/meta-api/INDEX.md` "Still Missing" list should be updated to remove this item.
