---
title: System Overview
tags: [architecture, system]
---

# System Overview

## Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.x |
| Database | MySQL 8.x (all data) |
| Cache | Redis 7.x — DB0 cache, DB1 security |
| Messaging | RabbitMQ 3.12.x — webhook async processing |
| Frontend | React 18, TypeScript 5, Vite, Shadcn/ui, Tailwind 3 |
| Serving | Nginx (reverse proxy) |

## Hierarchy

```
Account
  └── WABAs (WhatsApp Business Accounts)
        └── Phone Numbers
              └── Agents
```

## Data Flow — Inbound Webhook

```
Meta → POST /webhook → WebhookController
  → persist WebhookRaw (DB first)
  → RabbitMQ queue
  → ConversationService (parse → persist → analytics)
  Meta runs AI natively — we do NOT call Claude in the pipeline
```

## Data Flow — Agent Deploy

```
AgentDeployService.deploy()
  → PUT /agent_config/settings (Meta API FIRST)
  → on success: UPDATE agent SET status=active (DB second)
  → on Meta failure: no DB change
```

## What We Are

We are the **configuration layer** — not the AI layer.
Meta runs the AI natively. Claude is used only in the wizard (system prompt generation).
