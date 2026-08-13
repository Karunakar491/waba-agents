-- Founder-reported gap (2026-08-13): API Calls filter needed phone number
-- and agent id, but neither was queryable without re-parsing `path` on every
-- request. Both extracted once at write time (see ApiCallLogWriter) instead.
ALTER TABLE api_call_log ADD COLUMN phone_number_id VARCHAR(64) NULL;
ALTER TABLE api_call_log ADD COLUMN agent_id BIGINT NULL;
