-- Meta Business Agent Platform — Production Schema Extension
-- V2: Users, Refresh Tokens, Conversations, Messages, Analytics, Search Indexes

CREATE TABLE users (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    account_id      BIGINT          NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    role            ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
    status          ENUM('active', 'invited', 'suspended') NOT NULL DEFAULT 'active',
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_users_account FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_token_families (
    family_id       VARCHAR(36)     NOT NULL,
    user_id         BIGINT          NOT NULL,
    account_id      BIGINT          NOT NULL,
    token_hash      VARCHAR(128)    NOT NULL,
    revoked         BOOLEAN         NOT NULL DEFAULT FALSE,
    revoked_reason  VARCHAR(32)     NULL,
    issued_at       DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expires_at      DATETIME(6)     NOT NULL,
    PRIMARY KEY (family_id),
    CONSTRAINT fk_rtf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rtf_account FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT,
    INDEX idx_rtf_token_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversations (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    account_id      BIGINT          NOT NULL,
    agent_id        BIGINT          NOT NULL,
    external_id     VARCHAR(128)    NOT NULL,
    channel         ENUM('whatsapp', 'messenger', 'instagram') NOT NULL,
    status          ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    started_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_message_at DATETIME(6)     NULL,
    closed_at       DATETIME(6)     NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_conv_account FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT,
    CONSTRAINT fk_conv_agent FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_conv_external (agent_id, external_id),
    INDEX idx_conv_account_agent (account_id, agent_id),
    INDEX idx_conv_last_message (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    account_id      BIGINT          NOT NULL,
    conversation_id BIGINT          NOT NULL,
    agent_id        BIGINT          NOT NULL,
    direction       ENUM('inbound', 'outbound') NOT NULL,
    meta_message_id VARCHAR(128)    NULL,
    content_type    ENUM('text', 'image', 'document', 'audio', 'video', 'template') NOT NULL,
    content         TEXT            NULL,
    content_json    JSON            NULL,
    status          ENUM('received', 'sent', 'delivered', 'read', 'failed') NOT NULL,
    sent_at         DATETIME(6)     NULL,
    received_at     DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_msg_account FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT,
    CONSTRAINT fk_msg_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_msg_agent FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT,
    INDEX idx_msg_conversation (conversation_id, received_at),
    INDEX idx_msg_account_agent (account_id, agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE webhook_raw (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    account_id      BIGINT          NOT NULL,
    agent_id        BIGINT          NULL,
    payload         JSON            NOT NULL,
    signature       VARCHAR(128)    NOT NULL,
    status          ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    error_message   TEXT            NULL,
    received_at     DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at    DATETIME(6)     NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_webhook_account FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT,
    CONSTRAINT fk_webhook_agent FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT,
    INDEX idx_webhook_account_status (account_id, status),
    INDEX idx_webhook_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics Tables (Consolidated to MySQL)
CREATE TABLE webhook_events (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    account_id      BIGINT          NOT NULL,
    agent_id        BIGINT          NOT NULL,
    conversation_id BIGINT          NOT NULL,
    event_type      VARCHAR(64)     NOT NULL,
    channel         VARCHAR(32)     NOT NULL,
    received_at     DATETIME(6)     NOT NULL,
    processed_at    DATETIME(6)     NOT NULL,
    processing_ms   INT             NOT NULL,
    status          VARCHAR(32)     NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_we_account_agent (account_id, agent_id, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversation_sessions (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    account_id      BIGINT          NOT NULL,
    agent_id        BIGINT          NOT NULL,
    conversation_id BIGINT          NOT NULL,
    channel         VARCHAR(32)     NOT NULL,
    started_at      DATETIME(6)     NOT NULL,
    ended_at        DATETIME(6)     NULL,
    message_count   INT             NOT NULL DEFAULT 0,
    resolved        BOOLEAN         NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    INDEX idx_cs_account_agent (account_id, agent_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE agent_performance_hourly (
    id                      BIGINT          NOT NULL AUTO_INCREMENT,
    account_id              BIGINT          NOT NULL,
    agent_id                BIGINT          NOT NULL,
    hour                    DATETIME(6)     NOT NULL,
    messages_received       INT             NOT NULL DEFAULT 0,
    messages_sent           INT             NOT NULL DEFAULT 0,
    conversations_opened    INT             NOT NULL DEFAULT 0,
    conversations_closed    INT             NOT NULL DEFAULT 0,
    avg_response_ms         DOUBLE          NOT NULL DEFAULT 0.0,
    p95_response_ms         DOUBLE          NOT NULL DEFAULT 0.0,
    errors                  INT             NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_aph_hour (agent_id, hour),
    INDEX idx_aph_account_hour (account_id, hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    account_id      BIGINT          NOT NULL,
    user_id         BIGINT          NOT NULL,
    action          VARCHAR(64)     NOT NULL,
    entity_type     VARCHAR(64)     NOT NULL,
    entity_id       BIGINT          NOT NULL,
    changes_json    JSON            NULL,
    ip_address      VARCHAR(45)     NULL,
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    INDEX idx_al_account_created (account_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crawled website pages content for search
CREATE TABLE agent_website_page (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    website_id      BIGINT          NOT NULL,
    agent_id        BIGINT          NOT NULL,
    url             VARCHAR(2048)   NOT NULL,
    title           VARCHAR(512)    NULL,
    content_text    MEDIUMTEXT      NOT NULL,
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_awp_website FOREIGN KEY (website_id) REFERENCES agent_website(id) ON DELETE RESTRICT,
    CONSTRAINT fk_awp_agent FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Full-Text Search Indexes
ALTER TABLE agent_faq ADD FULLTEXT INDEX idx_faq_search (question, answer);
ALTER TABLE agent_website_page ADD FULLTEXT INDEX idx_page_search (title, content_text);
