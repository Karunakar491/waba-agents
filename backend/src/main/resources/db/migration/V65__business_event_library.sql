-- The named, reusable Business Event a person creates once and attaches to
-- many agents — the piece V63's own comment said would come later:
-- "business_event_id and business_event_binding_id are nullable because this
-- ships before the event library exists, and stay nullable afterwards — an
-- ad-hoc fire that names its own event type is legal forever."
--
-- Same two-layer shape as Skill (V20) / AgentSkillAttachment, per the
-- founder's own instruction: "Same like how we are doing for skills and
-- business persona."
--
--   library definition  ->  business_event          (this file)  ~ skill
--   attached instance    ->  business_event_binding  (this file)  ~ agent_skill_attachment
--
-- No Meta-side object to keep in sync (unlike a Skill), so the binding is
-- plain — just which agent carries which event, and when it was attached.

CREATE TABLE business_event (
    id           BIGINT UNSIGNED NOT NULL,
    account_id   BIGINT UNSIGNED NOT NULL,
    name         VARCHAR(64)     NOT NULL,
    description  VARCHAR(1024)   NOT NULL COMMENT 'What it is for — shown to the agent as guidance',
    guardrails   VARCHAR(2000)   NULL COMMENT 'Optional rules the agent should follow when writing this announcement',

    -- The three ways an event can be set off. Only MANUAL is buildable
    -- today; SYSTEM_WEBHOOK and CONNECTOR_WATCH are real founder-approved
    -- scope (R8 Q1/Q3) recorded here so the column never needs a later
    -- migration, but their firing mechanisms do not exist yet — the UI must
    -- show them as unavailable with a reason, not hide them.
    trigger_method ENUM('MANUAL', 'SYSTEM_WEBHOOK', 'CONNECTOR_WATCH') NOT NULL DEFAULT 'MANUAL',

    created_by   BIGINT UNSIGNED NULL,
    created_at   DATETIME(6) NOT NULL,
    updated_at   DATETIME(6) NOT NULL,

    PRIMARY KEY (id),
    KEY idx_business_event_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE business_event_binding (
    id                BIGINT UNSIGNED NOT NULL,
    agent_id          BIGINT UNSIGNED NOT NULL,
    business_event_id BIGINT UNSIGNED NOT NULL,
    created_at        DATETIME(6) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_binding_agent_event (agent_id, business_event_id),
    KEY idx_binding_event (business_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
