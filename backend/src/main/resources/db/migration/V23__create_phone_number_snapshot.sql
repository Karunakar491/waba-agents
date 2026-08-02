-- TASK-055: cache for WabaDtos.AccountPhoneNumber, populated by a login-
-- triggered background sync (see WabaService.listAllPhonesForAccountId /
-- PhoneNumberSyncService). Scoped per (account_id, phone_number_id) — not
-- per WABA — because agent visibility on a phone number is account-specific
-- (PhoneNumberAccessGuard), confirmed live 2026-07-28/29: the same real
-- phone number can show a different agent name/status depending on which
-- account is asking.
--
-- The existing live-Meta-call path (WabaService.listAllPhonesForAccount,
-- used by DashboardService) is NOT removed — it stays as the fallback for
-- an account with no snapshot yet (e.g. before first login-sync completes).

CREATE TABLE phone_number_snapshot (
    id                    BIGINT UNSIGNED NOT NULL,
    account_id            BIGINT UNSIGNED NOT NULL,
    phone_number_id       VARCHAR(64)     NOT NULL,
    display_phone_number  VARCHAR(32)     NULL,
    verified_name         VARCHAR(255)    NULL,
    waba_id               VARCHAR(32)     NULL,
    waba_label            VARCHAR(100)    NULL,
    has_agent             BOOLEAN         NOT NULL DEFAULT FALSE,
    agent_id              BIGINT UNSIGNED NULL,
    agent_name            VARCHAR(255)    NULL,
    agent_status          VARCHAR(16)     NULL,
    synced_at             DATETIME(6)     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_account_phone (account_id, phone_number_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
