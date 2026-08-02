-- TASK-068: TTL gate for reconciling Agent.status/enabled against Meta's real
-- rollout.enabled (agent_config/settings) — protects against status/enabled
-- drifting from reality if an agent is enabled/disabled directly on Meta,
-- outside this app.
ALTER TABLE agent ADD COLUMN status_reconciled_at DATETIME(6) NULL;
