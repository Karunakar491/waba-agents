-- Meta's agent_config/settings PUT can return an opaque agent_id (same class of
-- oversized platform ID seen in V14 — up to 107 chars observed). Recorded once on
-- first successful deploy so later settings PUTs can target agent_id directly
-- instead of silently creating a second agent on the same phone number.
ALTER TABLE agent ADD COLUMN meta_agent_id VARCHAR(255) NULL;
