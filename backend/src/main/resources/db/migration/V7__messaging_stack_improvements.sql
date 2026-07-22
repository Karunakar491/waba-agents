-- V7: Messaging stack improvements (TASK-028 + TASK-031)

-- TASK-028: Add 'interactive' to messages.content_type enum
-- Allows interactive message types (button replies, list selections) to be stored
-- correctly without conflating them with 'text' content type.
ALTER TABLE messages
    MODIFY COLUMN content_type
        ENUM('text', 'image', 'document', 'audio', 'video', 'template', 'interactive') NOT NULL;

-- TASK-031: Add account_id index on conversations for fast per-account list queries.
-- Prevents full table scan on conversation list endpoint at scale.
-- Composite index (account_id, last_message_at) covers the common sort pattern.
ALTER TABLE conversations
    ADD INDEX idx_conversations_account_last_message (account_id, last_message_at DESC);
