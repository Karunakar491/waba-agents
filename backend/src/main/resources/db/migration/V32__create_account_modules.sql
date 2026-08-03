-- BIGINT UNSIGNED per V5__normalize_ids_to_bigint_unsigned.sql — TSID values
-- use the full 64-bit unsigned range (high bit can be set); signed BIGINT
-- would reject/overflow those.
CREATE TABLE account_modules (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    account_id BIGINT UNSIGNED NOT NULL,
    module VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_account_module (account_id, module),
    CONSTRAINT fk_account_modules_business_account FOREIGN KEY (account_id) REFERENCES business_account(id)
);

-- Backfill: every existing account keeps access to the product they already
-- use today. Module gating is opt-in going forward for NEW modules — it must
-- never silently lock out an account that had full access a moment ago.
--
-- Row IDs here are a MySQL-side sequence (MAX(id) from account_modules + a
-- running offset), not TsidGenerator's scheme — a Flyway migration has no
-- JVM/NODE_ID context to generate real TSIDs. This is a one-time seed of a
-- brand-new table (no pre-existing rows to collide with), and every ID
-- generated here is smaller than any TSID the application will ever mint
-- (TsidGenerator's ms-since-2020-01-01 component alone exceeds 1.8e17 in
-- 2026, vs. the low integers used here) — so there is no future collision
-- window to bound.
INSERT INTO account_modules (id, account_id, module, enabled, created_at, updated_at)
SELECT
    ROW_NUMBER() OVER (ORDER BY id),
    id,
    'BUSINESS_AGENTS',
    TRUE,
    NOW(),
    NOW()
FROM business_account;
