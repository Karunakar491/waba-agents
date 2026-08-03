-- 2026-08-04: waba_karix_credential (one credential per WABA) was built on a
-- wrong assumption. Real Karix model: a credential belongs to an esme_addr
-- (a Karix account, one api_key each), and phone numbers map many-to-one
-- onto an esme_addr. The same esme_addr can also serve phone numbers under
-- DIFFERENT WABAs (confirmed by founder) — so the credential itself carries
-- no waba_id at all; only the phone->esme mapping is WABA-scoped.
--
-- waba_karix_credential had 0 rows in production at the time of this
-- migration (verified before writing this DROP) — no data migration needed.
DROP TABLE waba_karix_credential;

CREATE TABLE karix_esme_credential (
    id                BIGINT UNSIGNED NOT NULL,
    account_id        BIGINT UNSIGNED NOT NULL,
    esme_addr         VARCHAR(64)     NOT NULL,
    label             VARCHAR(100)    NOT NULL,
    encrypted_api_key TEXT            NOT NULL,
    created_at        DATETIME        NOT NULL,
    updated_at        DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_karix_esme_credential_esme_addr (esme_addr)
);

CREATE TABLE phone_esme_mapping (
    id                  BIGINT UNSIGNED NOT NULL,
    waba_id             BIGINT UNSIGNED NOT NULL,
    -- Meta's phone_number_id, matches phone_number_snapshot.phone_number_id.
    -- Not an FK — the snapshot is a resyncable cache, this mapping must
    -- survive a resync (or the snapshot row being briefly absent).
    phone_number_id     VARCHAR(64)     NOT NULL,
    esme_credential_id  BIGINT UNSIGNED NOT NULL,
    created_at          DATETIME        NOT NULL,
    updated_at          DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_phone_esme_mapping_waba_phone (waba_id, phone_number_id),
    CONSTRAINT fk_phone_esme_mapping_waba FOREIGN KEY (waba_id) REFERENCES waba (id),
    CONSTRAINT fk_phone_esme_mapping_credential FOREIGN KEY (esme_credential_id) REFERENCES karix_esme_credential (id)
);
