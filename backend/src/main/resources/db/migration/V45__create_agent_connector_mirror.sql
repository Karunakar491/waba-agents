-- Local mirror of Meta's connectors (founder decision 2026-08-13, reverses the
-- TASK-064 "Option A / no local mirror" call of 2026-07-30).
--
-- WHY: connectors were purely live-fetched. If Meta is unreachable the whole
-- Connectors Library renders empty, and we had nowhere to hang our own
-- metadata (system type, tags, published flag) that Meta has no concept of.
--
-- WHAT IS DELIBERATELY NOT HERE: secrets. No api keys, no oauth client_secret,
-- no certificates/private keys, no auth_config blob. Meta stays the sole
-- custodian of credential material; this table holds only descriptive fields
-- Meta already returns in plain text plus our own local-only labels.
--
-- IDENTITY: Meta's connector id is scoped to a phone number id, so it is NOT a
-- cross-agent identifier (docs/meta-api/connectors.md — connectors live under
-- /{phone_number_id}/agent_connectors and the API exposes no tenant-wide
-- connector entity). identity_key is therefore a HEURISTIC join key
-- (lower(name)|lower(base_url)) used only to count "used by N agents". It is
-- our own construct, not something Meta guarantees.
CREATE TABLE agent_connector (
    id                   BIGINT UNSIGNED NOT NULL,
    account_id           BIGINT UNSIGNED NOT NULL,
    agent_id             BIGINT UNSIGNED NOT NULL,
    meta_connector_id    VARCHAR(255)    NOT NULL COMMENT 'Meta connector id — unique per phone number, NOT cross-agent',
    phone_number_id      VARCHAR(255)    NULL,

    -- Meta-authoritative descriptive fields (upserted on every live read)
    name                 VARCHAR(255)    NOT NULL,
    description          VARCHAR(1024)   NULL,
    base_url             VARCHAR(1024)   NULL,
    auth_type            VARCHAR(64)     NULL COMMENT 'OAUTH2_CLIENT_CREDENTIALS | API_KEY | NONE',
    status               VARCHAR(32)     NULL COMMENT 'connection_status.status: PENDING_OAUTH|ACTIVE|EXPIRED|ERROR',
    requires_certificate BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Our own metadata — Meta has no concept of these, never overwritten by sync
    system_type          VARCHAR(64)     NULL COMMENT 'Shopify / Zendesk / Custom — our label',
    tags                 VARCHAR(512)    NULL COMMENT 'comma-separated, our label',
    published_to_library BOOLEAN         NOT NULL DEFAULT FALSE,

    identity_key         VARCHAR(512)    NULL COMMENT 'heuristic cross-agent key: lower(name)|lower(base_url)',
    last_synced_at       DATETIME(6)     NULL,
    created_at           DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_agent_connector_agent_meta (agent_id, meta_connector_id),
    KEY idx_agent_connector_account (account_id),
    KEY idx_agent_connector_identity (identity_key),
    CONSTRAINT fk_agent_connector_agent FOREIGN KEY (agent_id) REFERENCES agent(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
