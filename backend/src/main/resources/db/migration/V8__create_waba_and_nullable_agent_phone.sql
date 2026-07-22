-- WABA connection flow (spec section 5)
-- 1. waba table: account-level WABA registry. (account_id, waba_id) unique — one registration per account.
-- 2. agent.phone_number_id becomes nullable: agents are created without a phone, bound later via WABA flow.
--    Unique index retained — MySQL permits multiple NULLs in a unique index, so unbound agents coexist
--    while a bound phone number can only ever belong to one agent (race-safe "already connected" guard).
-- 3. agent.waba_id records which WABA the bound phone belongs to.

CREATE TABLE waba (
    id          BIGINT UNSIGNED NOT NULL,
    account_id  BIGINT UNSIGNED NOT NULL,
    waba_id     VARCHAR(32)     NOT NULL,
    label       VARCHAR(100)    NULL,
    status      ENUM('active','disconnected') NOT NULL DEFAULT 'active',
    created_at  DATETIME        NOT NULL,
    updated_at  DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_waba_account_waba (account_id, waba_id),
    KEY idx_waba_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE agent
    MODIFY COLUMN phone_number_id VARCHAR(255) NULL,
    ADD COLUMN waba_id BIGINT UNSIGNED NULL AFTER phone_number_id;
