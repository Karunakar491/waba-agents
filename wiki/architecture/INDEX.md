---
title: Architecture
tags: [architecture, index]
---

# Architecture

## Pages
- [[system-overview|System Overview]] — component diagram, data flows
- [[schema|Database Schema]] — all tables, FKs, Flyway migrations
- [[security|Security]] — JWT RS256, httpOnly cookie, Redis blacklist
- [[async|Async Topology]] — RabbitMQ, webhook processing, DLQ
- [[api-contracts|API Contracts]] — REST surface, request/response shapes

## Core Rules (never deviate)
- Monolith — not microservices (RAM constraint on t3.medium)
- `account_id` on **every** table — row-level tenant isolation
- FK strategy: RESTRICT + application-level soft delete
- Outbound Meta calls: **Meta API first, then DB commit**
- Inbound webhooks: **persist to DB first, then process**
- Frontend **never** calls Meta API — Karix BSP token is server-side only
- TSID for all IDs — time-sorted, BIGINT UNSIGNED, `NODE_ID` env var
- Redis DB0 = cache · DB1 = security state (JWT blacklist, lockout)
