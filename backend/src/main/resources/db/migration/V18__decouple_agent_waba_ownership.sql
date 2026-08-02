-- Agent/WABA ownership decoupling (founder decision 2026-07-28, see project memory).
-- Access to an Agent is now derived from waba_account_access, not agent.account_id.
-- agent.account_id is kept (not dropped) for one release as a safety net — Phase 2
-- work, not this migration.

ALTER TABLE agent ADD COLUMN updated_by BIGINT UNSIGNED NULL;

CREATE TABLE waba_account_access (
    id          BIGINT UNSIGNED NOT NULL,
    waba_id     BIGINT UNSIGNED NOT NULL,
    account_id  BIGINT UNSIGNED NOT NULL,
    granted_by  BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_waba_account (waba_id, account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill: every existing Waba's registering account gets an explicit access grant.
-- Hand-picked small sequential ids are safe here — TsidGenerator ids embed a
-- ms-since-2020-01-01 timestamp shifted left 22 bits, so real TSIDs are always
-- in the ~10^17 range; these backfill rows (1, 2, 3, ...) can never collide.
INSERT INTO waba_account_access (id, waba_id, account_id, granted_by, created_at)
SELECT ROW_NUMBER() OVER (ORDER BY w.id), w.id, w.account_id, w.account_id, NOW()
FROM waba w;
