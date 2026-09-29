-- R9 slice 4: eval case configs and Meta's own insight numbers have never
-- been persisted before — ReportsService/EvalRollupWorker call Meta live on
-- every read, nothing stored. Eval RUN results have no "list all past runs"
-- endpoint on Meta's side (only single-job-id polling, agent-eval.md) so
-- only the case *configuration* is something R9 can passively sync; running
-- an eval is a deliberate, costly action a person takes, not passive state
-- to mirror on every login.
CREATE TABLE agent_eval_case (
    id                BIGINT UNSIGNED NOT NULL,
    account_id        BIGINT UNSIGNED NOT NULL,
    agent_id          BIGINT UNSIGNED NOT NULL,
    meta_case_id      VARCHAR(255) NOT NULL,
    scenario          TEXT NULL,
    scenario_version  VARCHAR(64) NULL,
    categories        TEXT NULL COMMENT 'JSON array, verbatim from Meta',
    max_turns         INT NULL,
    success_criteria  TEXT NULL COMMENT 'JSON array, verbatim from Meta',
    created_at        DATETIME(6) NOT NULL,
    updated_at        DATETIME(6) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_agent_eval_case_meta (agent_id, meta_case_id),
    KEY idx_agent_eval_case_agent (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per agent, overwritten each sync — these are date-ranged
-- aggregates Meta recomputes on request, not an event log (agent_sync_log
-- already carries the "when was this last checked" history).
CREATE TABLE agent_insights_snapshot (
    id                       BIGINT UNSIGNED NOT NULL,
    account_id               BIGINT UNSIGNED NOT NULL,
    agent_id                 BIGINT UNSIGNED NOT NULL,
    range_start              DATE NULL,
    range_end                DATE NULL,
    ai_threads               INT NULL COMMENT 'insights/conversations — conversations the agent replied in at least once',
    ai_handoffs              INT NULL COMMENT 'insights/conversations — LIVE queue depth, ignores the date range (conversation-insights.md)',
    tool_call_insights       TEXT NULL COMMENT 'JSON array — insights/tool_calls, verbatim',
    agent_event_insights     TEXT NULL COMMENT 'JSON array — insights/agent_events, verbatim',
    synced_at                DATETIME(6) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_agent_insights_snapshot_agent (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE agent_sync_log
    MODIFY COLUMN category ENUM('SKILLS', 'FAQS', 'FILES', 'WEBSITES', 'BUSINESS_PERSONA', 'CONNECTORS', 'SETTINGS', 'EVAL_CASES', 'INSIGHTS') NOT NULL;
