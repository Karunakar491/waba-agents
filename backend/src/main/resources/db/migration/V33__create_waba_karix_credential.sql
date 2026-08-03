-- Per-WABA Karix RCM API credentials (esme_addr + api_key) — needed to mint
-- a karix-mcp JWT scoped to a specific waba_id (karix-mcp's own auth ties
-- one JWT to one waba_id; this platform manages many different client
-- WABAs, each with its own Karix-issued credential). Staff-entered, no
-- self-serve UI beyond a basic admin form. encrypted_api_key is AES-256-GCM
-- ciphertext (SecretEncryptor) — never plaintext.
CREATE TABLE waba_karix_credential (
    id                BIGINT UNSIGNED NOT NULL,
    waba_id           BIGINT UNSIGNED NOT NULL,
    esme_addr         VARCHAR(64)     NOT NULL,
    encrypted_api_key TEXT            NOT NULL,
    created_at        DATETIME        NOT NULL,
    updated_at        DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_waba_karix_credential_waba (waba_id),
    CONSTRAINT fk_waba_karix_credential_waba FOREIGN KEY (waba_id) REFERENCES waba (id)
);
