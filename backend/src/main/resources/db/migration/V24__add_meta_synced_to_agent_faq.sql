-- TASK-059 (P0): surface FAQ/Meta drift instead of silently trusting a WARN
-- log. TRUE by default — existing rows are assumed synced until the next
-- reconciliation read proves otherwise (reconcileFaqs runs reactively on
-- getFaqs(), same trigger point as Skills' ensureSkillsBackfilled).
ALTER TABLE agent_faq
    ADD COLUMN meta_synced BOOLEAN NOT NULL DEFAULT TRUE AFTER meta_faq_id;

-- true = a Meta sync was genuinely attempted for this row (success or
-- failure); false = created while the agent had no phoneNumberId yet, so
-- there was nothing to attempt. Reconciliation must not flag these.
ALTER TABLE agent_faq
    ADD COLUMN meta_sync_attempted BOOLEAN NOT NULL DEFAULT TRUE AFTER meta_synced;
