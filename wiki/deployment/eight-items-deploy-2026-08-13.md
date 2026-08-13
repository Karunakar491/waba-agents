---
title: Eight Critical Items — Production Deploy — 2026-08-13
tags: [deployment, migration, bug, ist]
date: 2026-08-13
---

# Eight Critical Items — Production Deploy

Deploy of [[../decisions/eight-critical-internal-feedback-items-2026-08-13|the 8-item fix]]. Full backup-first discipline: `mysqldump` of `meta_agent_db` taken immediately before V50/V51 (9.9MB, 38 tables confirmed present), old jar and `/var/www/metaagent` both backed up before each swap, every transfer byte-verified before use.

## Two real issues caught live, both fixed before this was called done

1. **V50 failed on first attempt** — `ALTER TABLE webhook_raw MODIFY COLUMN account_id BIGINT NULL` hit MySQL error 3780 ("Referencing column 'account_id' and referenced column 'id' in foreign key constraint 'fk_webhook_account' are incompatible"). Root cause: `V5__normalize_ids_to_bigint_unsigned.sql` made every id column `BIGINT UNSIGNED`, including the `business_account.id` this FK points to — my bare `BIGINT NULL` silently dropped `UNSIGNED`, which MySQL treats as a type mismatch against the FK target. Service crash-looped (`Active: activating (auto-restart)`). Verified the schema was untouched (MySQL DDL is atomic per-statement; `account_id` was still `NOT NULL bigint unsigned` after the failure), removed Flyway's own failed-attempt bookkeeping row (`DELETE FROM flyway_schema_history WHERE version='50' AND success=0` — its metadata, not business data), fixed the migration to `BIGINT UNSIGNED NULL`, rebuilt, redeployed. Second attempt succeeded clean.
2. **Silent TSID precision-loss bug in the new `ApiCallLog.agentId` field** — caught only by cross-checking a real value between two endpoints (Agents list showed `875641532756004864`, API Calls log showed `875641532756004900` for the same agent). Root cause: every other TSID field in this codebase carries `@JsonSerialize(using = ToStringSerializer.class)` because TSIDs overflow `Number.MAX_SAFE_INTEGER` in JavaScript — the new `agentId` column I added to `ApiCallLog` for item 2's filter was missing it. Without the fix, the "Agent ID" filter would have been unusable: an operator copying the id shown on the Agents list and pasting it into the API Calls filter would never get a match, because the id displayed elsewhere in the log itself was already silently corrupted. Fixed, rebuilt, redeployed, re-verified the two ids now match exactly and that filtering by that id actually returns only that agent's rows.

## Verification performed after the final deploy
- Clean startup log: `Successfully applied 2 migrations to schema meta_agent_db, now at version v51`.
- `flyway_schema_history`: versions 50 and 51 both `success=1`.
- Real login via the app's own API (no direct DB access), then:
  - Agents list returns real `personaDescription`/`displayPhoneNumber` (confirmed against a real historical Business Persona row, "MDH Spices...").
  - `webhooks/raw` and `reports/api-calls` both return populated `phoneNumberId`/`agentId`.
  - Cross-checked the same agent's id character-for-character equal between the Agents list and the API Calls log (the precision-loss regression test).
  - Filtering both `webhooks/raw` and `reports/api-calls` by that exact agent id returns only that agent's rows.

## Related
- [[../decisions/eight-critical-internal-feedback-items-2026-08-13|Eight Critical Internal-Feedback Items]]
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
