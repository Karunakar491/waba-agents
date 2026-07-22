---
title: Database Schema
tags: [architecture, schema, mysql]
---

# Database Schema

**DB:** `meta_agent_db` on MySQL 8.x
**Migrations:** Flyway — never manual. All in `backend/src/main/resources/db/migration/`

## Migrations Applied (dev server as of 2026-07-19)

| Version | File | What |
|---|---|---|
| V1 | `V1__init.sql` | business_account, agent, agent_skill, agent_faq, agent_file, agent_website, user |
| V2 | `V2__production_schema.sql` | conversations, messages, webhook_raw, analytics tables |
| V3 | `V3__add_system_prompt_to_agents.sql` | `system_prompt TEXT NULL` on agent |
| V4 | `V4__add_account_id_to_agent_child_entities.sql` | `account_id` on faq, skill, file, website, website_page |
| V5 | `V5__normalize_ids_to_bigint_unsigned.sql` | All PK/FK → BIGINT UNSIGNED (TSID) |
| V6 | `V6__add_status_and_deployed_at_to_agent.sql` | `status` enum + `deployed_at` on agent |

## Key Rules
- Every table has `account_id BIGINT UNSIGNED NOT NULL` — tenant isolation
- All PKs are TSID (not UUID, not auto-increment)
- FKs use `ON DELETE RESTRICT` — never CASCADE
- Soft deletes in application layer, not DB triggers
- `ddl-auto: validate` — Hibernate validates against Flyway schema, never generates DDL
