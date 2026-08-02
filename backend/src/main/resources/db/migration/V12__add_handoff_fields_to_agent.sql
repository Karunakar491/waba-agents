-- Human handoff is a real per-agent setting, not a hardcoded literal (settings.md handoff field).
-- Additive, nullable-safe — existing agents default to handoff disabled, no backfill needed.
ALTER TABLE agent
    ADD COLUMN handoff_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN handoff_message VARCHAR(1000) NULL;
