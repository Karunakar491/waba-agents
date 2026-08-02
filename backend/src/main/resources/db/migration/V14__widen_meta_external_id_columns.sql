-- Meta opaque platform IDs (e.g. FAQ/skill/file/website config IDs returned from
-- agent_config/* POST responses) can exceed 64 chars — observed 107 chars in production.
-- VARCHAR(64) truncation caused MysqlDataTruncation on every Meta sync call.
ALTER TABLE agent_faq MODIFY COLUMN meta_faq_id VARCHAR(255);
ALTER TABLE agent_skill MODIFY COLUMN meta_skill_id VARCHAR(255);
ALTER TABLE agent_file MODIFY COLUMN meta_file_id VARCHAR(255);
ALTER TABLE agent_website MODIFY COLUMN meta_website_id VARCHAR(255);
