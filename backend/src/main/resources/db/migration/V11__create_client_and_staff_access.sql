-- Client entity (spec: 2026-07-22-ia-revision.md, module 5) — real table, not a view over WABA data.
-- Meta API calls key off this record; staff access is many-to-many since a client's WABA
-- can be shared between multiple internal Karix staff (not exclusively owned by one person).
-- Phone numbers + health are NOT duplicated here — fetched live from Meta via the existing
-- waba/phone_numbers Graph API call (see WabaService.getPhones), keyed off client.waba_id.

CREATE TABLE client (
    id                  BIGINT UNSIGNED NOT NULL,
    account_id          BIGINT UNSIGNED NOT NULL,
    name                VARCHAR(150)    NOT NULL,
    waba_id             BIGINT UNSIGNED NULL,
    credit_line_status  ENUM('good_standing','warning','suspended') NOT NULL DEFAULT 'good_standing',
    created_by          BIGINT UNSIGNED NOT NULL,
    updated_by          BIGINT UNSIGNED NOT NULL,
    created_at          DATETIME        NOT NULL,
    updated_at          DATETIME        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_client_account (account_id),
    KEY idx_client_waba (waba_id),
    CONSTRAINT fk_client_waba FOREIGN KEY (waba_id) REFERENCES waba (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Staff <-> client access grant. Many-to-many, not a single owner_id on client.
CREATE TABLE client_staff (
    id          BIGINT UNSIGNED NOT NULL,
    client_id   BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    granted_by  BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_client_staff (client_id, user_id),
    KEY idx_client_staff_user (user_id),
    CONSTRAINT fk_client_staff_client FOREIGN KEY (client_id) REFERENCES client (id),
    CONSTRAINT fk_client_staff_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit trail for Client edits — no Envers/JPA-auditing convention exists elsewhere in this
-- codebase, so this follows a plain append-only log table, same pattern as every other entity here.
CREATE TABLE client_audit_log (
    id              BIGINT UNSIGNED NOT NULL,
    client_id       BIGINT UNSIGNED NOT NULL,
    changed_by      BIGINT UNSIGNED NOT NULL,
    change_summary  VARCHAR(500)    NOT NULL,
    changed_at      DATETIME        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_client_audit_client (client_id, changed_at),
    CONSTRAINT fk_client_audit_client FOREIGN KEY (client_id) REFERENCES client (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
