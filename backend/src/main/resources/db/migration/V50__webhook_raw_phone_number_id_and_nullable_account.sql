-- Founder-reported gap (2026-08-13): "log ALL webhooks, every kind" — but
-- WebhookController currently drops (never persists) any payload it can't
-- attribute to a known agent (unknown phone_number_id) or that fails
-- signature verification. Both cases have no known accountId, and
-- webhook_raw.account_id was NOT NULL, so there was no way to persist them
-- even if the controller wanted to. Relaxing this is additive/widening only
-- (loosens a constraint, does not touch existing rows) — every row written
-- so far already has a real account_id and is unaffected.
-- Must match V5's BIGINT UNSIGNED exactly (not bare BIGINT) — MySQL error
-- 3780 rejects a FK column whose type no longer matches the referenced
-- column (business_account.id) once UNSIGNED is dropped. Confirmed live
-- (2026-08-13): the bare-BIGINT version failed migration on first deploy
-- attempt, rolled back cleanly (Flyway wraps each migration in a
-- transaction), no data at risk.
ALTER TABLE webhook_raw MODIFY COLUMN account_id BIGINT UNSIGNED NULL;

-- phone_number_id lets the Webhooks view filter by number without
-- re-parsing the JSON payload every time, and lets an unattributable
-- payload still carry a filterable identity even with agent_id/account_id
-- both null.
ALTER TABLE webhook_raw ADD COLUMN phone_number_id VARCHAR(64) NULL;
