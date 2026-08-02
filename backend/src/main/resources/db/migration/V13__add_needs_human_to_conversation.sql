-- Scaffold for standby/handoff detection (provisional — see docs/meta-api/webhook-standby-handoff.md).
ALTER TABLE conversations ADD COLUMN needs_human BOOLEAN NOT NULL DEFAULT FALSE;
