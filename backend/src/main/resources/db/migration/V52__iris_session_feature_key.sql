-- 2026-08-18. Iris is now a shared assistant engine (domain/iris) used by
-- both Template Studio's own chat UI and the Business Agents Create-Agent
-- wizard (AgentCreationToolProvider) — this column tags which feature owns
-- a session, so the two can be told apart in support/analytics/logs.
-- Additive only: nullable-with-default, existing rows backfilled to the
-- one feature that existed before this column, per
-- wiki/decisions/2026-08-12-iris-generalization-plan.md step 3.
ALTER TABLE iris_session ADD COLUMN feature_key VARCHAR(64) NULL AFTER waba_id;

-- 'template_studio' here must match IrisConversationService.DEFAULT_FEATURE_KEY —
-- the app-side default any future row falling back through that same value.
UPDATE iris_session SET feature_key = 'template_studio' WHERE feature_key IS NULL;
