-- Settings tab (tone/language/behaviorRules/handoff) currently saves to our
-- DB only via PUT /agents/{id} — nothing pushes handoff config to Meta.
-- This column tracks when handoff was last actually published to Meta's
-- agent_config/settings, so the UI can show a real "not published" state
-- instead of assuming a local save reached Meta.
ALTER TABLE agent ADD COLUMN handoff_published_at TIMESTAMP NULL;
