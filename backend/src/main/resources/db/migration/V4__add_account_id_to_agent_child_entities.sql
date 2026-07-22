-- Multi-tenant isolation fix: add account_id to all agent child entity tables.
-- Allows direct tenant-scoped queries without requiring a join to the agents table.

ALTER TABLE agent_faq ADD COLUMN account_id BIGINT UNSIGNED NOT NULL AFTER id;
ALTER TABLE agent_skill ADD COLUMN account_id BIGINT UNSIGNED NOT NULL AFTER id;
ALTER TABLE agent_file ADD COLUMN account_id BIGINT UNSIGNED NOT NULL AFTER id;
ALTER TABLE agent_website ADD COLUMN account_id BIGINT UNSIGNED NOT NULL AFTER id;
ALTER TABLE agent_website_page ADD COLUMN account_id BIGINT UNSIGNED NOT NULL AFTER id;
