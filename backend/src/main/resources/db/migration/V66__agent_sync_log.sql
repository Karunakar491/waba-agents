-- R9 slice 1: one row per (agent, category, sync attempt). Append-only —
-- "last synced" and "did the last sync find drift" are both derived by
-- querying the latest row per (agent_id, category), never overwritten in
-- place, so AC#8 ("what Meta's value was before the overwrite") survives
-- past the next sync.
CREATE TABLE agent_sync_log (
    id              BIGINT UNSIGNED NOT NULL,
    account_id      BIGINT UNSIGNED NOT NULL,
    agent_id        BIGINT UNSIGNED NOT NULL,
    trigger_source  ENUM('PHONE_ADD', 'LOGIN', 'DAILY') NOT NULL,
    category        ENUM('SKILLS', 'FAQS', 'FILES', 'WEBSITES', 'BUSINESS_PERSONA', 'CONNECTORS') NOT NULL,
    status          ENUM('SUCCESS', 'FAILED') NOT NULL,
    changed         TINYINT(1) NOT NULL DEFAULT 0,
    before_snapshot TEXT NULL COMMENT 'What our DB held for this category immediately before Meta''s value overwrote it — null when nothing changed',
    error_message   VARCHAR(1024) NULL,
    synced_at       DATETIME(6) NOT NULL,

    PRIMARY KEY (id),
    KEY idx_agent_sync_log_agent_category (agent_id, category, synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
