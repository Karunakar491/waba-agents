-- V6: Add status lifecycle and deployedAt timestamp to the agent table.
-- status drives the deploy/pause state machine in AgentDeployService.
-- deployed_at records when the agent was last made live on Meta.

ALTER TABLE agent
    ADD COLUMN status      ENUM('draft', 'active', 'paused', 'deleted') NOT NULL DEFAULT 'draft' AFTER enabled,
    ADD COLUMN deployed_at DATETIME(6) NULL AFTER status;
