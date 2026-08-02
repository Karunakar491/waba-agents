-- TASK-066: TTL gate for the display-name backfill (existing "Imported agent
-- (<id>)" rows resolving their real Meta verified_name reactively, not just
-- on first import — see WabaAgentReconciliationService.resolveDisplayName).
ALTER TABLE agent ADD COLUMN display_name_reconciled_at DATETIME(6) NULL;
