---
title: Meta Business Agent Platform — Wiki
tags: [index, root]
---

# Meta Business Agent Platform

> SaaS platform where businesses create and manage Meta Business Agents — AI agents on WhatsApp, Messenger, Instagram via Meta's Business Messaging APIs.
> Built by Karix BSP. Standard: Anthropic quality.

---

## Sections

| Section | What lives here |
|---|---|
| [[architecture/INDEX\|Architecture]] | System design, component diagram, schema, data flows, security |
| [[decisions/INDEX\|Decisions]] | Every architectural and product decision with rationale |
| [[frontend/INDEX\|Frontend]] | Stack, design system, Karix brand, component library |
| [[deployment/INDEX\|Deployment]] | Server config, runbooks, hard-won lessons |
| [[bugs-violations/INDEX\|Bugs & Violations]] | All CLAUDE.md violations, bug post-mortems |
| [[docs/INDEX\|Docs]] | Product spec, API surface, Meta API reference |
| [[api/INDEX\|API]] | Backend API endpoints, request/response contracts |
| [[sessions/INDEX\|Sessions]] | What was built each session — running changelog |

---

## Quick Reference

- **Backend:** Spring Boot 3.x, Java 21, MySQL 8, Redis, RabbitMQ
- **Frontend:** React 18, TypeScript 5, Vite, Shadcn/ui, Tailwind 3
- **Server:** ubuntu@10.1.17.16 via bastion ec2-user@13.232.241.246
- **App port:** 8080 (stop karix-messaging first)
- **Brand:** Navy `#160E7A` · Pink `#E73590` · Font: Inter
- **Standard:** [[decisions/maker-checker|Maker-Checker]] — PM + EM before code, EL after. No self-approval.
