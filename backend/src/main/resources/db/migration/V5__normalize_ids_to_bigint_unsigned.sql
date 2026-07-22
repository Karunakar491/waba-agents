-- V5: Normalize all primary key and foreign key id columns to BIGINT UNSIGNED.
-- Required for TSID compatibility — TSID produces 64-bit values that use the full
-- unsigned range. Signed BIGINT would reject values with the high bit set.
--
-- Order: drop FKs first, alter columns, recreate FKs.

-- -----------------------------------------------------------------------
-- Drop all FK constraints that reference id columns being changed
-- -----------------------------------------------------------------------

ALTER TABLE agent              DROP FOREIGN KEY fk_agent_account;
ALTER TABLE users              DROP FOREIGN KEY fk_users_account;
ALTER TABLE refresh_token_families DROP FOREIGN KEY fk_rtf_user;
ALTER TABLE refresh_token_families DROP FOREIGN KEY fk_rtf_account;
ALTER TABLE conversations      DROP FOREIGN KEY fk_conv_account;
ALTER TABLE conversations      DROP FOREIGN KEY fk_conv_agent;
ALTER TABLE messages           DROP FOREIGN KEY fk_msg_account;
ALTER TABLE messages           DROP FOREIGN KEY fk_msg_conversation;
ALTER TABLE messages           DROP FOREIGN KEY fk_msg_agent;
ALTER TABLE webhook_raw        DROP FOREIGN KEY fk_webhook_account;
ALTER TABLE webhook_raw        DROP FOREIGN KEY fk_webhook_agent;
ALTER TABLE agent_faq          DROP FOREIGN KEY fk_faq_agent;
ALTER TABLE agent_skill        DROP FOREIGN KEY fk_skill_agent;
ALTER TABLE agent_file         DROP FOREIGN KEY fk_file_agent;
ALTER TABLE agent_website      DROP FOREIGN KEY fk_website_agent;
ALTER TABLE agent_website_page DROP FOREIGN KEY fk_awp_website;
ALTER TABLE agent_website_page DROP FOREIGN KEY fk_awp_agent;

-- -----------------------------------------------------------------------
-- business_account
-- -----------------------------------------------------------------------
ALTER TABLE business_account
    MODIFY id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- agent
-- -----------------------------------------------------------------------
ALTER TABLE agent
    MODIFY id         BIGINT UNSIGNED NOT NULL,
    MODIFY account_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------
ALTER TABLE users
    MODIFY id         BIGINT UNSIGNED NOT NULL,
    MODIFY account_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- refresh_token_families  (PK is VARCHAR — only FK columns change)
-- -----------------------------------------------------------------------
ALTER TABLE refresh_token_families
    MODIFY user_id    BIGINT UNSIGNED NOT NULL,
    MODIFY account_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- conversations
-- -----------------------------------------------------------------------
ALTER TABLE conversations
    MODIFY id         BIGINT UNSIGNED NOT NULL,
    MODIFY account_id BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id   BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------
ALTER TABLE messages
    MODIFY id              BIGINT UNSIGNED NOT NULL,
    MODIFY account_id      BIGINT UNSIGNED NOT NULL,
    MODIFY conversation_id BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id        BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- webhook_raw
-- -----------------------------------------------------------------------
ALTER TABLE webhook_raw
    MODIFY id         BIGINT UNSIGNED NOT NULL,
    MODIFY account_id BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id   BIGINT UNSIGNED NULL;

-- -----------------------------------------------------------------------
-- webhook_events  (no FK constraints — standalone analytics table)
-- -----------------------------------------------------------------------
ALTER TABLE webhook_events
    MODIFY id              BIGINT UNSIGNED NOT NULL,
    MODIFY account_id      BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id        BIGINT UNSIGNED NOT NULL,
    MODIFY conversation_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- conversation_sessions  (no FK constraints — standalone analytics table)
-- -----------------------------------------------------------------------
ALTER TABLE conversation_sessions
    MODIFY id              BIGINT UNSIGNED NOT NULL,
    MODIFY account_id      BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id        BIGINT UNSIGNED NOT NULL,
    MODIFY conversation_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- agent_performance_hourly  (no FK constraints — standalone analytics table)
-- -----------------------------------------------------------------------
ALTER TABLE agent_performance_hourly
    MODIFY id         BIGINT UNSIGNED NOT NULL,
    MODIFY account_id BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id   BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- audit_log  (no FK constraints)
-- -----------------------------------------------------------------------
ALTER TABLE audit_log
    MODIFY id         BIGINT UNSIGNED NOT NULL,
    MODIFY account_id BIGINT UNSIGNED NOT NULL,
    MODIFY user_id    BIGINT UNSIGNED NOT NULL,
    MODIFY entity_id  BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- agent_faq  (account_id already BIGINT UNSIGNED from V4)
-- -----------------------------------------------------------------------
ALTER TABLE agent_faq
    MODIFY id       BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- agent_skill  (account_id already BIGINT UNSIGNED from V4)
-- -----------------------------------------------------------------------
ALTER TABLE agent_skill
    MODIFY id       BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- agent_file  (account_id already BIGINT UNSIGNED from V4)
-- -----------------------------------------------------------------------
ALTER TABLE agent_file
    MODIFY id       BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- agent_website  (account_id already BIGINT UNSIGNED from V4)
-- -----------------------------------------------------------------------
ALTER TABLE agent_website
    MODIFY id       BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- agent_website_page  (account_id already BIGINT UNSIGNED from V4)
-- -----------------------------------------------------------------------
ALTER TABLE agent_website_page
    MODIFY id         BIGINT UNSIGNED NOT NULL,
    MODIFY website_id BIGINT UNSIGNED NOT NULL,
    MODIFY agent_id   BIGINT UNSIGNED NOT NULL;

-- -----------------------------------------------------------------------
-- Recreate all foreign key constraints
-- -----------------------------------------------------------------------

ALTER TABLE agent
    ADD CONSTRAINT fk_agent_account
        FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE users
    ADD CONSTRAINT fk_users_account
        FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE refresh_token_families
    ADD CONSTRAINT fk_rtf_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT fk_rtf_account
        FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE conversations
    ADD CONSTRAINT fk_conv_account
        FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT fk_conv_agent
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE messages
    ADD CONSTRAINT fk_msg_account
        FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT fk_msg_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT fk_msg_agent
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE webhook_raw
    ADD CONSTRAINT fk_webhook_account
        FOREIGN KEY (account_id) REFERENCES business_account(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT fk_webhook_agent
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE agent_faq
    ADD CONSTRAINT fk_faq_agent
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE agent_skill
    ADD CONSTRAINT fk_skill_agent
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE agent_file
    ADD CONSTRAINT fk_file_agent
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE agent_website
    ADD CONSTRAINT fk_website_agent
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE agent_website_page
    ADD CONSTRAINT fk_awp_website
        FOREIGN KEY (website_id) REFERENCES agent_website(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT fk_awp_agent
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
