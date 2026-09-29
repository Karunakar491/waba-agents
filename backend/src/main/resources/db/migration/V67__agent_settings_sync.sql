-- R9 slice 3: settings has never had a local column to sync into before —
-- ai_audience/followup/allowlist/never_say_phrases were always read live
-- from Meta and never persisted (AgentDeployService reads them fresh on
-- every write to avoid clobbering them, but nothing stored what they were).
-- handoff already has columns (V49); this adds the rest so
-- AccountSyncService has somewhere to write Meta's values.
ALTER TABLE agent
    ADD COLUMN ai_audience       VARCHAR(32) NULL COMMENT 'Meta settings.md ai_audience — ALLOWLISTED_ONLY or EVERYONE',
    ADD COLUMN followup_enabled  TINYINT(1)  NULL,
    ADD COLUMN followup_message  VARCHAR(1000) NULL,
    ADD COLUMN never_say_phrases TEXT NULL COMMENT 'JSON array — Meta settings.md never_say_phrases, full replacement list',
    ADD COLUMN allowlist_snapshot TEXT NULL COMMENT 'JSON array — Meta agent_config/allowlist, read-only mirror; no local editor for it yet';

-- New sixth... seventh category for the R9 sync log.
ALTER TABLE agent_sync_log
    MODIFY COLUMN category ENUM('SKILLS', 'FAQS', 'FILES', 'WEBSITES', 'BUSINESS_PERSONA', 'CONNECTORS', 'SETTINGS') NOT NULL;
