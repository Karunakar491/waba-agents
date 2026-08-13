-- Reusable Connector Library (founder direction 2026-08-13):
-- "My objective is to have reusable agents, skills and connectors, even if
--  Meta doesn't allow or support we can make the provision right. Meta just
--  exposes the APIs, we build the product."
--
-- This is the SAME two-layer shape the Skill Library already uses (V20):
--
--   library definition   ->  connector             (this file)   ~ skill
--   deployed instance    ->  connector_deployment  (this file)   ~ agent_skill_attachment
--   live-state cache     ->  agent_connector       (V45)         ~ (skills have none)
--
-- V45's agent_connector is NOT replaced. It stays exactly what it is: a cache
-- of what Meta currently reports per phone number. This layer sits ABOVE it —
-- our own definition of a connector that exists whether or not it has ever
-- been pushed to Meta, and which can be deployed to many agents.
--
-- SECRETS: connector.auth_config_shape holds FIELD NAMES ONLY (which header
-- carries the key, which OAuth token_url/scopes to use). It never holds a key,
-- a client_secret, or certificate material. Those are supplied per-deployment
-- at deploy time, forwarded straight to Meta, and never written to any column
-- here. Same rule V45 set, extended to the library layer.
CREATE TABLE connector (
    id                   BIGINT UNSIGNED NOT NULL,
    account_id           BIGINT UNSIGNED NOT NULL COMMENT 'Creator — access is derived via waba_id + waba_account_access',
    waba_id              BIGINT UNSIGNED NULL COMMENT 'Internal waba.id FK. Library is WABA-scoped, same as skill.waba_id.',

    name                 VARCHAR(255)    NOT NULL,
    description          VARCHAR(1024)   NOT NULL COMMENT 'The agent reads this to know what the connector is for — Meta requires it',
    system_type          VARCHAR(64)     NULL COMMENT 'Shopify / Zendesk / Custom — our label, Meta has no such field',
    base_url             VARCHAR(1024)   NOT NULL,
    auth_type            VARCHAR(64)     NOT NULL COMMENT 'OAUTH2_CLIENT_CREDENTIALS | API_KEY | NONE',
    auth_config_shape    TEXT            NULL COMMENT 'JSON: field NAMES and non-secret OAuth settings only. NEVER credential values.',
    requires_certificate BOOLEAN         NOT NULL DEFAULT FALSE,
    tags                 VARCHAR(512)    NULL COMMENT 'comma-separated, our label',
    status               VARCHAR(16)     NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT | PUBLISHED — publishing is ours, not a Meta concept',

    created_at           DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at           DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY idx_connector_waba (waba_id),
    KEY idx_connector_account (account_id),
    CONSTRAINT fk_connector_waba FOREIGN KEY (waba_id) REFERENCES waba (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One library connector deployed onto one agent. meta_connector_id lives HERE,
-- not on connector: Meta scopes connector ids to a phone number, so the same
-- library definition gets a different Meta id on every agent it lands on —
-- identical reasoning to agent_skill_attachment.meta_skill_id (V20).
--
-- This is what makes "Used by N agents" a real COUNT(*) instead of V45's
-- name+base_url heuristic.
CREATE TABLE connector_deployment (
    id                BIGINT UNSIGNED NOT NULL,
    connector_id      BIGINT UNSIGNED NOT NULL,
    agent_id          BIGINT UNSIGNED NOT NULL,
    meta_connector_id VARCHAR(255)    NULL COMMENT 'Per-(agent,connector). NULL = create call has not succeeded yet.',
    phone_number_id   VARCHAR(255)    NULL COMMENT 'The number it was deployed onto, as of deploy time',
    deployed_at       DATETIME(6)     NULL COMMENT 'NULL = never reached Meta. Compare against connector.updated_at for out-of-sync.',
    last_error        VARCHAR(1024)   NULL COMMENT 'Last failure from Meta, so a failed deploy is visible rather than silent',
    created_at        DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_connector_deployment (connector_id, agent_id),
    KEY idx_connector_deployment_agent (agent_id),
    CONSTRAINT fk_connector_deployment_connector FOREIGN KEY (connector_id) REFERENCES connector (id),
    CONSTRAINT fk_connector_deployment_agent FOREIGN KEY (agent_id) REFERENCES agent (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
