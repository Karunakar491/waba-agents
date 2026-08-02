-- Shared Skill Library — first slice of the Library consolidation (supersedes
-- TASK-046's design). One `skill` row per Library entry (nullable waba_id:
-- set = shared across every agent on that WABA, null = not yet shared).
-- `agent_skill_attachment` is the join between an agent and a Library skill —
-- editing the Library row does NOT push to Meta; it only makes the attachment
-- "out of sync" (skill.updated_at > attachment.deployed_at). Pushing to Meta
-- happens only via an explicit per-agent "Sync skills" action, which stamps
-- deployed_at + the agent-specific meta_skill_id on success.
--
-- Existing `agent_skill` rows (legacy, immediate-write-to-Meta) are UNCHANGED
-- by this migration — they keep working exactly as today until a human
-- explicitly "Promotes" one to the Library (application-level action, not
-- part of this migration).

CREATE TABLE skill (
    id              BIGINT UNSIGNED NOT NULL,
    account_id      BIGINT UNSIGNED NOT NULL COMMENT 'Creator — access is derived via waba_id + waba_account_access when set',
    waba_id         BIGINT UNSIGNED NULL COMMENT 'Internal waba.id FK. NULL = not yet shared with any WABA.',
    title           VARCHAR(64)     NOT NULL,
    description     VARCHAR(1024)   NOT NULL,
    body            TEXT            NOT NULL COMMENT 'Max 20000 chars per Meta spec',
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_skill_waba (waba_id),
    CONSTRAINT fk_skill_waba FOREIGN KEY (waba_id) REFERENCES waba (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE agent_skill_attachment (
    id              BIGINT UNSIGNED NOT NULL,
    agent_id        BIGINT UNSIGNED NOT NULL,
    skill_id        BIGINT UNSIGNED NOT NULL,
    meta_skill_id   VARCHAR(64)     NULL COMMENT 'Per-(agent,skill) — the same Library skill has a different Meta skill id on each agent it is attached to',
    deployed_at     DATETIME(6)     NULL COMMENT 'NULL = never pushed to Meta for this agent yet. Compare against skill.updated_at to compute out-of-sync.',
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_agent_skill (agent_id, skill_id),
    KEY idx_attachment_skill (skill_id),
    CONSTRAINT fk_attachment_agent FOREIGN KEY (agent_id) REFERENCES agent (id),
    CONSTRAINT fk_attachment_skill FOREIGN KEY (skill_id) REFERENCES skill (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
