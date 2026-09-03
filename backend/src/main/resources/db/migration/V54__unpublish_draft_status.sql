-- Additive only (Kill Switch discipline): new nullable/defaulted columns,
-- no renames, no drops. Backs the Unpublish/Draft feature for Skills, UI
-- Skills, and FAQ — lets an operator pull something off Meta without losing
-- its content locally, and bring it back later.

ALTER TABLE agent_skill
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'published',
    ADD COLUMN previous_meta_skill_id VARCHAR(255) NULL,
    ADD COLUMN unpublished_at DATETIME NULL;

ALTER TABLE agent_ui_skill
    ADD COLUMN publish_status VARCHAR(16) NOT NULL DEFAULT 'published',
    ADD COLUMN previous_meta_ui_skill_id VARCHAR(255) NULL,
    ADD COLUMN unpublished_at DATETIME NULL;

ALTER TABLE agent_faq
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'published',
    ADD COLUMN previous_meta_faq_id VARCHAR(255) NULL,
    ADD COLUMN unpublished_at DATETIME NULL;
