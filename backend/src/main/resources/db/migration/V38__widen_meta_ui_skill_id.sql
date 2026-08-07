-- Same bug class as V14 (meta_faq_id/meta_skill_id/meta_file_id/meta_website_id):
-- Meta's opaque platform IDs can exceed 64 chars. Caught live (2026-08-07) via a
-- real create_ui_skill call: MysqlDataTruncation on meta_ui_skill_id VARCHAR(64).
ALTER TABLE agent_ui_skill MODIFY COLUMN meta_ui_skill_id VARCHAR(255);
