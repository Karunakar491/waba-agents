-- Same class of bug V14 already fixed for agent_faq/agent_skill/agent_file/
-- agent_website: Meta's opaque platform IDs (observed 107+ chars) exceed
-- VARCHAR(64) — V20's new agent_skill_attachment table repeated the mistake
-- V14 had already fixed elsewhere. Confirmed live 2026-07-29: MysqlDataTruncation
-- on the first real promote() call against MDH Assistant.
ALTER TABLE agent_skill_attachment MODIFY COLUMN meta_skill_id VARCHAR(255);
