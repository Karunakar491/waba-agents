---
title: Messaging Stack
tags: [architecture, messaging, webhook, rabbitmq]
---

# Messaging Stack

## Flow

```
Meta Platform
    │ POST /api/v1/webhook (X-Hub-Signature-256 header)
    ▼
WebhookController
    │ 1. Verify HMAC-SHA256 signature (TASK-024)
    │ 2. Persist to webhook_raw (status=PENDING)
    │ 3. Publish to RabbitMQ: webhook.raw queue
    │ 4. Return 200 immediately (Meta requires fast ack)
    ▼
WebhookListener (RabbitMQ consumer)
    │ ConversationService.processWebhookEvent(webhookRawId, accountId, agentId)
    ▼
ConversationService
    │ 1. Atomic CAS: claim PENDING → PROCESSING (idempotency guard)
    │ 2. Try InboundMessageParser → if inbound message:
    │      a. findOrCreate conversation
    │      b. saveInbound (sets lastMessageAt in same tx)
    │      c. publishAnalyticsEvent (non-fatal — try/catch)
    │ 3. If not inbound → try StatusUpdateParser:
    │      a. status=sent → saveOutbound (creates record)
    │      b. status=delivered/read/failed → updateMessageStatus
    │ 4. markProcessed
    ▼
MySQL
    conversations, messages, webhook_raw
```

## Tables

| Table | Purpose |
|---|---|
| `webhook_raw` | Full JSON payload, status lifecycle PENDING→PROCESSING→PROCESSED/FAILED |
| `conversations` | One per (account, agent, customer_phone) |
| `messages` | Every inbound + outbound message with `direction`, `status`, `content_type`, `content_json` |

## Message Status Lifecycle

```
inbound:  received (on persist)
outbound: sent → delivered → read  (driven by Meta status webhooks)
           └→ failed (on failure status)
```

## Key Design Decisions

- **Meta runs the AI.** We are configuration layer. No Claude in message pipeline.
- **Outbound records created on first status receipt** (`sent`), not proactively (Decision D1, 2026-07-20).
- **Non-text messages persisted with `content_type` and `content_json`** — no silent drops. Media rendering is a future P2 task.
- **Idempotency via atomic CAS** — `UPDATE ... WHERE status = 'PENDING'`. Only one consumer wins.

## Known Gaps (as of 2026-07-20)

| Gap | Task | Status |
|---|---|---|
| @Transactional on private methods silently ignored | TASK-023 | TODO |
| No webhook signature verification | TASK-024 | TODO |
| No idempotency guard | TASK-025 | TODO |
| Status webhooks discarded | TASK-026 | TODO |
| touchLastMessageAt race | TASK-027 | TODO |
| Non-text types silently dropped | TASK-028 | TODO |
| No DLQ on webhook.raw | TASK-029 | TODO |
| Analytics failure can abort message persist | TASK-030 | TODO |
| No conversations account_id index | TASK-031 | TODO |
| webhook_raw grows unbounded | TASK-032 | TODO |
</content>
</invoke>