-- UI Skills API (F22) — a distinct Meta surface from agent_config/skills
-- (plain text-instruction skills). A UI skill tells the agent WHEN/HOW to
-- send a specific rich-message component (carousel, CTA button, interactive
-- list, location request) — it does not carry the component's own content,
-- Meta's schema for it is just a routing/trigger definition. `flow` type is
-- intentionally excluded per product decision (Flows are out of scope,
-- see F9 in AUDIT-TASKS.md) — no flow_id column.
CREATE TABLE agent_ui_skill (
    id              BIGINT UNSIGNED NOT NULL,
    account_id      BIGINT UNSIGNED NOT NULL,
    agent_id        BIGINT UNSIGNED NOT NULL,
    meta_ui_skill_id VARCHAR(64)    COMMENT 'ID returned by Meta after POST',
    title           VARCHAR(64)     NOT NULL,
    component_type  ENUM('carousel_quick_reply','carousel_url','cta_url','image','interactive_list','location','location_request') NOT NULL,
    status          ENUM('enabled','disabled') NOT NULL DEFAULT 'disabled',
    instruction     VARCHAR(1024)   NOT NULL,
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_agent_ui_skill_agent (agent_id),
    CONSTRAINT fk_ui_skill_agent FOREIGN KEY (agent_id) REFERENCES agent(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
