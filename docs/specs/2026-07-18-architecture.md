# System Architecture — Meta Business Agent Platform
**Version:** 1.0.0  
**Date:** 2026-07-18  
**Authors:** Engineering Manager (design) + Engineering Lead (corrections)  
**Status:** Approved — single source of truth

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Architecture](#2-component-architecture)
3. [Data Flows](#3-data-flows)
4. [Schema Design](#4-schema-design)
5. [API Design](#5-api-design)
6. [Security](#6-security)
7. [Async & Event System](#7-async--event-system)
8. [Analytics Pipeline](#8-analytics-pipeline)
9. [Infrastructure](#9-infrastructure)
10. [Risks & Mitigations](#10-risks--mitigations)

---

## 1. System Overview

### Purpose

SaaS platform enabling non-technical businesses to create, configure, and operate AI agents on Meta channels (WhatsApp, Messenger, Instagram) via Meta's Business Messaging APIs.

The platform is the abstraction layer between Meta's raw Cloud API and business operators who cannot consume raw APIs.

### Tenancy Model

Multi-tenant, account-isolated. Each account owns:
- One or more Meta Business pages/numbers (WABA)
- One or more agents (per channel or persona)
- Full data isolation at the database row level (account_id on every table)

### Design Principles

- **RESTRICT over CASCADE** — application owns cascading logic; DB enforces referential integrity only
- **Inbound webhook: persist first, process second** — no data loss on downstream failure
- **Outbound calls: API first, DB second** — DB reflects confirmed external state only
- **Consistent hash routing** — conversation ordering guaranteed across consumer restarts
- **Single-use refresh token rotation** — token reuse triggers full family revocation

---

## 2. Component Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                              │
│   Browser SPA (Next.js)          Mobile (future)               │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS / WSS
┌────────────────────▼────────────────────────────────────────────┐
│                      API GATEWAY (Kong)                         │
│   Auth   Rate-Limit   Routing   TLS Termination                 │
└───┬───────────────┬──────────────────┬───────────────────┬──────┘
    │               │                  │                   │
┌───▼───┐    ┌──────▼──────┐   ┌───────▼──────┐   ┌───────▼──────┐
│ Auth  │    │ Agent Mgmt  │   │  Webhook     │   │  Analytics   │
│Service│    │ Service     │   │  Service     │   │  Service     │
│:8081  │    │ :8082       │   │  :8083       │   │  :8084       │
└───┬───┘    └──────┬──────┘   └───────┬──────┘   └───────┬──────┘
    │               │                  │                   │
    └───────────────┴──────────────────┴───────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        ┌─────▼─────┐   ┌───────▼──────┐   ┌─────▼──────┐
        │   MySQL   │   │    Redis     │   │ ClickHouse │
        │ (primary) │   │  DB0 / DB1   │   │ (analytics)│
        └───────────┘   └──────────────┘   └────────────┘
              │
        ┌─────▼─────┐
        │  RabbitMQ │
        │ (events)  │
        └─────┬─────┘
              │
        ┌─────▼──────────────────┐
        │  Conversation Service  │
        │  (Claude + Meta API)   │
        │  :8085                 │
        └────────────────────────┘
              │
        ┌─────▼──────────────────┐
        │  Meta Cloud API        │
        │  (WhatsApp / Messenger │
        │   / Instagram)         │
        └────────────────────────┘
```

### Services

| Service | Responsibility | Port |
|---|---|---|
| Auth Service | JWT issuance, refresh rotation, session management | 8081 |
| Agent Mgmt Service | CRUD for agents, configs, deployments | 8082 |
| Webhook Service | Receive Meta webhooks, persist, enqueue | 8083 |
| Analytics Service | Query ClickHouse, serve dashboards | 8084 |
| Conversation Service | Run agent loop: Claude API + Meta send | 8085 |

### Redis Layout

| DB | Contents |
|---|---|
| DB 0 | Application cache: agent configs, session data, rate-limit counters |
| DB 1 | Security state: JWT blacklist, refresh token families, account lockout flags |

Separation prevents cache eviction from touching security state.

---

## 3. Data Flows

### 3.1 Outbound Calls (Deploy, Settings, Configuration)

**Rule: Meta API first, then DB.**

DB reflects confirmed external state. Never write DB before the external call succeeds.

```
Client Request
     │
     ▼
API Gateway → Agent Mgmt Service
                    │
                    ▼
             Validate + Build Meta API payload
                    │
                    ▼
             Call Meta Cloud API ──► Success?
                    │                    │ YES
                    │              Write to MySQL
                    │                    │
                    │              Return 200 to client
                    │
                    │              NO (Meta API error)
                    └──────────────► Return error to client
                                        (DB unchanged)
```

This applies to: agent deployment, phone number registration, webhook subscription, settings updates, template submission.

### 3.2 Inbound Webhooks (Meta → Platform)

**Rule: Persist payload to DB FIRST, then process.**

Processing failure must never cause data loss. The raw payload is the source of truth.

```
Meta Cloud API
     │
     ▼ POST /webhook/{accountId}
Webhook Service
     │
     ├─1─► Verify X-Hub-Signature-256 (HMAC-SHA256, platform app secret)
     │         │ FAIL → 403, stop
     │
     ├─2─► Persist raw payload to MySQL webhook_raw (status=PENDING)
     │         │ FAIL → 500, Meta will retry
     │
     ├─3─► ACK to Meta (200 OK) ◄── must be within 20s
     │
     └─4─► Publish event to RabbitMQ (webhook.received)
               │
               ▼
         Conversation Service (consumer)
               │
               ├─► Process message (Claude API → reply)
               │
               ├─► Call Meta send API
               │
               └─► Update webhook_raw status=PROCESSED
```

The 200 ACK is sent after DB write (step 3), before processing. This guarantees Meta does not retry while processing is in-flight.

### 3.3 Auth Flow

```
Client → POST /auth/login
              │
              ▼
         Verify credentials (bcrypt cost 12)
              │
              ▼
         Issue access token (15 min) + refresh token (7 days)
         Store refresh token family in Redis DB1
              │
              ▼
         Return tokens to client

Client → POST /auth/refresh (refresh_token)
              │
              ▼
         Look up token in Redis DB1
              │
              ├─ NOT FOUND → 401 (expired or already rotated)
              │
              ├─ REUSE DETECTED (token was already rotated) →
              │   Revoke entire family (all sessions for this user)
              │   Return 401
              │
              └─ VALID →
                  Invalidate old token
                  Issue new access token + new refresh token
                  Store new token in same family
                  Return new tokens
```

---

## 4. Schema Design

### Design Rules

1. **RESTRICT foreign keys** — all FK constraints use `ON DELETE RESTRICT`. Application code performs soft-delete cascades explicitly (set deleted_at, update status). No silent cascade deletes.
2. **Soft deletes everywhere** — `deleted_at TIMESTAMP NULL` on all business entities.
3. **account_id on every table** — enables row-level multi-tenancy validation.
4. **TSID for IDs** — 64-bit sortable IDs. Node ID configured per-instance via env var `NODE_ID=0..1023`. Each service instance must have a unique NODE_ID configured at deploy time.

### MySQL Tables

#### accounts
```sql
CREATE TABLE accounts (
  id           BIGINT UNSIGNED NOT NULL,           -- TSID
  name         VARCHAR(255)    NOT NULL,
  email        VARCHAR(320)    NOT NULL UNIQUE,
  plan         ENUM('starter','growth','enterprise') NOT NULL DEFAULT 'starter',
  status       ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at   TIMESTAMP       NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### users
```sql
CREATE TABLE users (
  id           BIGINT UNSIGNED NOT NULL,
  account_id   BIGINT UNSIGNED NOT NULL,
  email        VARCHAR(320)    NOT NULL UNIQUE,
  password_hash VARCHAR(72)    NOT NULL,            -- bcrypt cost 12
  role         ENUM('owner','admin','member')       NOT NULL DEFAULT 'member',
  status       ENUM('active','invited','suspended') NOT NULL DEFAULT 'invited',
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at   TIMESTAMP       NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_users_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,         -- EL: RESTRICT not CASCADE
  INDEX idx_users_account_id (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### agents
```sql
CREATE TABLE agents (
  id              BIGINT UNSIGNED NOT NULL,
  account_id      BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(255)    NOT NULL,
  channel         ENUM('whatsapp','messenger','instagram') NOT NULL,
  status          ENUM('draft','active','paused','deleted') NOT NULL DEFAULT 'draft',
  system_prompt   TEXT            NULL,
  meta_page_id    VARCHAR(64)     NULL,
  meta_phone_number_id VARCHAR(64) NULL,
  waba_id         VARCHAR(64)     NULL,
  deployed_at     TIMESTAMP       NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP       NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_agents_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,         -- EL: RESTRICT not CASCADE
  INDEX idx_agents_account_id (account_id),
  INDEX idx_agents_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### webhook_raw
```sql
CREATE TABLE webhook_raw (
  id              BIGINT UNSIGNED NOT NULL,
  account_id      BIGINT UNSIGNED NOT NULL,
  agent_id        BIGINT UNSIGNED NULL,
  payload         JSON            NOT NULL,         -- raw Meta payload
  signature       VARCHAR(128)    NOT NULL,         -- verified X-Hub-Signature-256
  status          ENUM('PENDING','PROCESSING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
  error_message   TEXT            NULL,
  received_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at    TIMESTAMP       NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_webhook_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_webhook_agent
    FOREIGN KEY (agent_id) REFERENCES agents(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_webhook_account_status (account_id, status),
  INDEX idx_webhook_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### conversations
```sql
CREATE TABLE conversations (
  id              BIGINT UNSIGNED NOT NULL,
  account_id      BIGINT UNSIGNED NOT NULL,
  agent_id        BIGINT UNSIGNED NOT NULL,
  external_id     VARCHAR(128)    NOT NULL,         -- Meta conversation/thread ID
  channel         ENUM('whatsapp','messenger','instagram') NOT NULL,
  status          ENUM('open','closed') NOT NULL DEFAULT 'open',
  started_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP       NULL,
  closed_at       TIMESTAMP       NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_conv_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_conv_agent
    FOREIGN KEY (agent_id) REFERENCES agents(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  UNIQUE KEY uq_conv_external (agent_id, external_id),
  INDEX idx_conv_account_agent (account_id, agent_id),
  INDEX idx_conv_last_message (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### messages
```sql
CREATE TABLE messages (
  id              BIGINT UNSIGNED NOT NULL,
  account_id      BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT UNSIGNED NOT NULL,
  agent_id        BIGINT UNSIGNED NOT NULL,
  direction       ENUM('inbound','outbound') NOT NULL,
  meta_message_id VARCHAR(128)    NULL,
  content_type    ENUM('text','image','document','audio','video','template') NOT NULL,
  content         TEXT            NULL,
  content_json    JSON            NULL,
  status          ENUM('received','sent','delivered','read','failed') NOT NULL,
  sent_at         TIMESTAMP       NULL,
  received_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_msg_account
    FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_msg_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_msg_agent
    FOREIGN KEY (agent_id) REFERENCES agents(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_msg_conversation (conversation_id, received_at),
  INDEX idx_msg_account_agent (account_id, agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### refresh_token_families
```sql
CREATE TABLE refresh_token_families (
  family_id       VARCHAR(36)     NOT NULL,         -- UUID
  user_id         BIGINT UNSIGNED NOT NULL,
  account_id      BIGINT UNSIGNED NOT NULL,
  token_hash      VARCHAR(128)    NOT NULL,          -- SHA-256 of current valid token
  revoked         BOOLEAN         NOT NULL DEFAULT FALSE,
  revoked_reason  ENUM('logout','reuse_detected','admin') NULL,
  issued_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP       NOT NULL,
  PRIMARY KEY (family_id),
  CONSTRAINT fk_rtf_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_rtf_user (user_id),
  INDEX idx_rtf_token_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> **Note:** refresh_token_families is the durable record. Redis DB1 holds the hot cache of valid token hashes for sub-millisecond lookup. On Redis miss, fall back to MySQL.

### ClickHouse Tables

All ClickHouse tables use the MergeTree family. ORDER BY keys are explicit and required — they define the primary index and determine query performance.

#### webhook_events
```sql
CREATE TABLE webhook_events (
  account_id      UInt64,
  agent_id        UInt64,
  conversation_id UInt64,
  event_type      LowCardinality(String),
  channel         LowCardinality(String),
  received_at     DateTime,
  processed_at    DateTime,
  processing_ms   UInt32,
  status          LowCardinality(String)
) ENGINE = MergeTree()
ORDER BY (account_id, agent_id, received_at)   -- EL: explicit ORDER BY
PARTITION BY toYYYYMM(received_at)
TTL received_at + INTERVAL 1 YEAR;
```

#### conversation_sessions
```sql
CREATE TABLE conversation_sessions (
  account_id      UInt64,
  agent_id        UInt64,
  conversation_id UInt64,
  channel         LowCardinality(String),
  started_at      DateTime,
  ended_at        DateTime,
  message_count   UInt32,
  resolved        UInt8                            -- 0/1 boolean
) ENGINE = MergeTree()
ORDER BY (account_id, agent_id, started_at)    -- EL: explicit ORDER BY
PARTITION BY toYYYYMM(started_at)
TTL started_at + INTERVAL 1 YEAR;
```

#### agent_performance_hourly
```sql
CREATE TABLE agent_performance_hourly (
  account_id              UInt64,
  agent_id                UInt64,
  hour                    DateTime,
  messages_received       UInt32,
  messages_sent           UInt32,
  conversations_opened    UInt32,
  conversations_closed    UInt32,
  avg_response_ms         Float32,
  p95_response_ms         Float32,
  errors                  UInt32
) ENGINE = MergeTree()
ORDER BY (account_id, agent_id, hour)           -- EL: explicit ORDER BY
PARTITION BY toYYYYMM(hour);
```

#### audit_log
```sql
CREATE TABLE audit_log (
  account_id      UInt64,
  user_id         UInt64,
  action          LowCardinality(String),
  entity_type     LowCardinality(String),
  entity_id       UInt64,
  changes_json    String,
  ip_address      String,
  created_at      DateTime
) ENGINE = MergeTree()
ORDER BY (account_id, created_at)               -- EL: explicit ORDER BY
PARTITION BY toYYYYMM(created_at)
TTL created_at + INTERVAL 2 YEAR;
```

---

## 5. API Design

### Conventions

- Base path: `/api/v1/`
- Auth: `Authorization: Bearer <access_token>` on all protected routes
- Tenant scoping: all responses scoped to `accountId` from the JWT claim — never from URL
- IDs in responses: TSID as string (JS cannot safely handle 64-bit integers)
- Errors: `{ "error": { "code": "AGENT_NOT_FOUND", "message": "..." } }`
- Pagination: cursor-based (`?after=<tsid>&limit=20`)

### Auth Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account + owner user |
| POST | `/auth/login` | Issue access + refresh token |
| POST | `/auth/refresh` | Rotate refresh token (single-use) |
| POST | `/auth/logout` | Revoke refresh token family |
| POST | `/auth/forgot-password` | Send reset email |
| POST | `/auth/reset-password` | Consume reset token, set new password |

### Agent Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/agents` | List agents for account |
| POST | `/agents` | Create agent |
| GET | `/agents/:id` | Get agent |
| PATCH | `/agents/:id` | Update agent config |
| DELETE | `/agents/:id` | Soft-delete agent (RESTRICT: blocks if active conversations) |
| POST | `/agents/:id/deploy` | Deploy to Meta (Meta API first, then DB) |
| POST | `/agents/:id/pause` | Pause agent |

### Conversation Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/agents/:id/conversations` | List conversations (cursor-paginated) |
| GET | `/conversations/:id` | Get conversation + messages |
| GET | `/conversations/:id/messages` | Messages only (cursor-paginated) |

### Webhook Endpoint

| Method | Path | Description |
|---|---|---|
| GET | `/webhook/:accountId` | Meta hub challenge verification |
| POST | `/webhook/:accountId` | Inbound webhook from Meta |

### Analytics Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/agents/:id/performance` | Hourly performance metrics |
| GET | `/analytics/agents/:id/conversations` | Conversation volume |
| GET | `/analytics/account/summary` | Account-level summary |

---

## 6. Security

### Authentication

- **Access tokens:** JWT, HS256, 15-minute TTL. Signed with secret from env.
- **Refresh tokens:** opaque random 32-byte token, stored as SHA-256 hash. Single-use rotation (see below).
- **Password hashing:** bcrypt, cost factor **12** (explicitly set — do not use library default).
- **Account lockout:** 5 failed login attempts → 15-minute lockout. Lockout state in Redis DB1.

### Refresh Token Rotation (Single-Use)

Every `/auth/refresh` call:

1. Look up token hash in Redis DB1 (fast path) or MySQL refresh_token_families (fallback).
2. **If token not found:** return 401.
3. **If token found but family is revoked:** return 401. (Already handled reuse attack.)
4. **If token found and valid:**
   a. Mark old token as used (delete from Redis DB1, update MySQL token_hash).
   b. Issue new refresh token.
   c. Store new token hash in Redis DB1 and MySQL.
   d. Return new access token + new refresh token.
5. **Reuse detection:** if a token arrives that was already rotated (hash exists in MySQL history but is not the current token_hash), revoke the entire family immediately. All active sessions for this user are invalidated. Return 401.

Reuse detection protects against stolen token replay. The attacker and the legitimate user cannot both succeed — whichever calls refresh second triggers full revocation.

### Per-Tenant Rate Limiting

- **Implementation:** Redis token bucket per `accountId`, keyed in Redis DB0.
- **Default limit:** 100 requests/minute per account.
- **Enforced at:** API Gateway (Kong) + Auth Service double-check.
- **Response on limit:** HTTP 429 with `Retry-After` header.
- **Plan overrides:** Growth plan = 500 req/min, Enterprise = configurable.

```
Key:   rate_limit:{accountId}
TTL:   60 seconds (sliding window)
Value: counter (INCR + EXPIRE on first request)
```

### Webhook Verification

- **App secret:** Platform-wide single secret registered with Meta Cloud API (Cloud API model — one app, one secret). **Not per-account.** Meta signs all inbound webhooks with `X-Hub-Signature-256: sha256=<hmac>`.
- **Verification:** `HMAC-SHA256(raw_body, APP_SECRET)` must match header value. Reject with 403 on mismatch.
- **APP_SECRET** stored in environment variable — never in DB or code.

### Transport & Secrets

- TLS 1.2 minimum everywhere (Kong enforces).
- Secrets in environment variables only. No hardcoded values. No secrets in DB.
- Internal service-to-service: mTLS (future) or private VPC with no public exposure.

### TSID Node ID

- Each service instance must configure `NODE_ID` environment variable (range: 0–1023).
- Duplicate node IDs across instances will cause TSID collisions. Deploy tooling must enforce unique assignment.
- Document assigned node IDs in deployment runbook.

---

## 7. Async & Event System

### RabbitMQ Topology

```
Exchange: platform.events (topic)
   │
   ├── webhook.received    → queue: webhook-processing
   ├── agent.deployed      → queue: agent-lifecycle
   ├── agent.paused        → queue: agent-lifecycle
   ├── message.sent        → queue: analytics-ingest
   └── message.failed      → queue: dlq.message-failed
```

Dead-letter queues (DLQ) on all consumer queues. Failed messages after 3 retries → DLQ with original payload + error envelope.

### Webhook Processing Consumer

```
Consumer: ConversationService
Queue: webhook-processing
Concurrency: configurable (default: 10 goroutines/threads per instance)

On message received:
  1. Deserialize event
  2. Load agent config from Redis DB0 (cache) or MySQL
  3. Retrieve conversation history from MySQL
  4. Call Claude API (claude-sonnet-4-5, streaming)
  5. Call Meta send API (outbound → Meta API first)
  6. Persist outbound message to MySQL
  7. Publish message.sent event
  8. Update webhook_raw status=PROCESSED
  9. ACK RabbitMQ message
```

On any step failure: NACK (requeue with backoff), up to 3 retries, then DLQ.

### Webhook Message Ordering — HIGH RISK

**Risk:** Multiple consumers may process messages for the same conversation out of order, corrupting conversation state.

**Mitigation (v1):** Consistent hashing by `conversation_id` routes all messages for a conversation to the same consumer instance.

```
partition_key = hash(conversation_id) % num_consumers
consumer[partition_key] processes all messages for this conversation
```

Implementation: RabbitMQ consistent hash exchange plugin, or application-level routing via `x-consistent-hash` header. On consumer restart, partition rebalancing is acceptable (brief gap) — ordering is guaranteed during steady state.

**Mitigation (v2, when scale demands):** Kafka with partition key = `conversation_id`. Consider when message volume exceeds RabbitMQ operational comfort (~50k msg/s).

**Severity:** HIGH — out-of-order processing produces wrong AI context and incorrect replies. Must be implemented before first production deployment.

### Thread Control — HIGH RISK

**Risk:** MetaThreadControlProtocol has breaking API changes between minor versions. v2.0 changed handover behavior and broke v1.0 integrations silently.

**Mitigation:** Pin `MetaThreadControlClient` to **v1.0.0** explicitly in package manifest. Do not use `^1.0.0` or `~1.0.0` (allows minor/patch upgrades). Lock to exact version. Upgrade only after explicit testing against staging environment.

**Severity:** HIGH — silent breakage causes human handover to fail, leaving conversations stuck.

---

## 8. Analytics Pipeline (MySQL Consolidated)

### Data Flow

```
MySQL (operational)
    │
    ▼ (internal event dispatcher or local listener)
RabbitMQ: message.sent events
    │
    ▼
Analytics Service (consumer)
    │
    ├──► MySQL: webhook_events (raw events)
    ├──► MySQL: conversation_sessions (session facts)
    └──► MySQL: agent_performance_hourly (pre-aggregated rollup)
```

### Aggregation Strategy

- **Real-time:** Raw events written to `webhook_events` on every message.
- **Hourly rollup:** Scheduled Spring Boot `@Scheduled` job at HH:05 aggregates the prior hour's data into `agent_performance_hourly`.
- **Dashboard queries:** Fetch data from `agent_performance_hourly` for time-series charts (very fast). Query `webhook_events` for specific drilldowns.

### Resolution Rate Calculation

The **Resolution Rate** for an agent over a given time window is calculated as follows:
- **Condition for Resolution:** A conversation is "Resolved" if its status is `closed`, or if the `last_message_at` timestamp is more than 24 hours in the past and no handoff/escalation event occurred during that conversation.
- **SQL Aggregation formula:**
```sql
SELECT 
    agent_id,
    COUNT(CASE WHEN last_message_at < NOW() - INTERVAL 24 HOUR AND status = 'open' THEN 1 END) +
    COUNT(CASE WHEN status = 'closed' THEN 1 END) AS resolved_count,
    COUNT(*) AS total_conversations,
    (COUNT(CASE WHEN last_message_at < NOW() - INTERVAL 24 HOUR AND status = 'open' THEN 1 END) +
     COUNT(CASE WHEN status = 'closed' THEN 1 END)) * 100.0 / COUNT(*) AS resolution_rate
FROM conversations
WHERE started_at >= :start_time AND started_at <= :end_time
GROUP BY agent_id;
```

### Audit Log

- All writes to `agents`, `users`, and `accounts` tables emit an audit log entry.
- Audit events are written to the MySQL `audit_log` table.
- Retention: 2 years (regulatory).
- Queryable by `account_id` + `created_at` range, utilizing an index on `(account_id, created_at)`.

---

## 9. Infrastructure

### Target Environment

AWS, single-region (ap-south-1), multi-AZ for HA.

### Compute

| Component | Instance Type | Notes |
|---|---|---|
| API Services (x4) | t3a.medium (2 vCPU, 4 GB) | Behind ALB, auto-scale 2–10 |
| Conversation Service | t3a.large (2 vCPU, 8 GB) | Claude API calls are latency-sensitive |
| MySQL | db.t3.medium (RDS, Multi-AZ) | Automated backups, 7-day retention |
| Redis | cache.t3.medium (ElastiCache) | DB0 + DB1, cluster mode off (single shard) |
| RabbitMQ | mq.m5.large (Amazon MQ) | Durable queues, mirrored |
| ClickHouse | **t3a.large minimum** (self-managed EC2) | See risk note below |

### ClickHouse Instance Risk

t3.medium / t3a.medium are **burstable** CPU instances. ClickHouse aggregation queries are CPU-intensive. A sustained analytics load can exhaust CPU credits, causing severe query latency degradation with no memory or disk warning.

**Minimum recommended:** t3a.large (2 vCPU, 8 GB). For production with >10 accounts actively querying: dedicated r6g.large or separate ClickHouse instance not sharing credits with other workloads.

### Networking

```
Internet
  │
  ▼
ALB (HTTPS :443)
  │
  ▼
Kong API Gateway (private subnet)
  │
  ▼
Services (private subnet, no public IPs)
  │
  ▼
RDS / ElastiCache / MQ (private subnet, VPC-only)
```

### Container Strategy

- All services containerized (Docker).
- Orchestration: ECS Fargate (v1). Migrate to EKS when operational complexity justifies it.
- Image registry: ECR.
- CI/CD: GitHub Actions → ECR → ECS rolling deploy.

### Environment Variables Required Per Service

```
# All services
NODE_ID=<0..1023>            # TSID node — MUST be unique per instance
DB_URL=...
REDIS_URL=...
JWT_SECRET=...

# Auth Service
BCRYPT_COST=12               # Must be explicit — never rely on library default

# Webhook Service
META_APP_SECRET=...          # Platform-wide Cloud API app secret
RABBITMQ_URL=...

# Conversation Service
CLAUDE_API_KEY=...
META_API_BASE_URL=https://graph.facebook.com/v19.0
```

---

## 10. Risks & Mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Webhook message ordering corrupts conversation state | HIGH | Consistent hash routing by conversation_id to same consumer. Must be live before production. |
| R2 | MetaThreadControlClient v2.0 breaks handover silently | HIGH | Pin to v1.0.0 exact version. No semver ranges. Explicit staging test before upgrade. |
| R3 | Refresh token reuse (stolen token replay) | HIGH | Single-use rotation with family revocation on reuse detection. |
| R4 | ClickHouse CPU credit exhaustion on burstable instance | MEDIUM | Use t3a.large minimum. Monitor `CPUCreditBalance` CloudWatch alarm at <20% threshold. |
| R5 | Outbound deploy writes DB before Meta API confirms | HIGH | Enforce API-first write order in Agent Mgmt Service. Code review checklist item. |
| R6 | Webhook payload lost if processing fails before DB write | HIGH | Persist raw payload to DB before ACK. Processing failure safe to retry. |
| R7 | TSID collision from duplicate NODE_ID | MEDIUM | Deploy tooling enforces unique NODE_ID per instance. Alert on TSID collision at application layer. |
| R8 | Per-tenant rate limit bypass via concurrent requests | MEDIUM | Redis INCR is atomic. Token bucket implementation must use Lua script for atomic check-and-increment. |
| R9 | Meta app secret exposed in logs | HIGH | Structured logging must scrub `META_APP_SECRET` and all bearer tokens. Log audit before production. |
| R10 | bcrypt cost factor set too low by library default | MEDIUM | Explicitly configure `BCRYPT_COST=12` in env. Application startup assertion: refuse to start if cost < 12. |

### Resolved Questions

| Question | Resolution |
|---|---|
| Webhook app secret: per-account or platform-wide? | **Platform-wide.** Meta Cloud API model uses a single app with one app secret. All inbound webhooks signed with the same secret. Account routing handled by URL path (`/webhook/:accountId`). |
| CASCADE vs RESTRICT on FK deletes? | **RESTRICT.** Application performs explicit soft-delete cascades. DB enforces referential integrity only. |
| DB Consolidation for Analytics? | **Consolidated to MySQL.** Analytics tables (`webhook_events`, `conversation_sessions`, etc.) are written directly to MySQL to reduce operational cost and memory usage. |
| Resolution Rate Definition? | **Resolved if inactive for 24h.** Classified as resolved if a thread has no customer activity for 24 consecutive hours and no handoffs occurred. Calculated via MySQL rolling queries. |
| Knowledge Ingestion Guardrails? | **10MB file cap & 20-page crawl limit.** Restricted to 10MB per document (plain text parser for PDF/Docx) and 1 crawl depth level with a max of 20 scraped pages to prevent token bloat. |
| Refresh token rotation model? | Single-use with family revocation on reuse. See Section 6. |

---

## Appendix: Open Items (Not Blocking v1)

| Item | Owner | Target |
|---|---|---|
| mTLS between internal services | Engineering Lead | v1.1 |
| Kafka migration from RabbitMQ at scale | Engineering Manager | When needed |
| Multi-region failover design | Engineering Manager | v2.0 |
| RBAC beyond owner/admin/member | Product Manager | v1.1 |
| Template management (Meta HSM) | Product Manager | v1.1 |

---

*Document generated 2026-07-18. All corrections from Engineering Lead code review applied inline. This is the implementation baseline.*
