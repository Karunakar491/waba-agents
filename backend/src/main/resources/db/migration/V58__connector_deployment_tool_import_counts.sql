-- 2026-09-20. How many tools Meta listed, and how many we could store.
--
-- The connector backfill skips a tool whose request_definition it cannot
-- parse, rather than storing "{}" — an empty object is a valid-LOOKING payload
-- that would be pushed to Meta on the next deploy as a tool that silently does
-- nothing. Skipping is the honest choice, but on its own it produces a quieter
-- lie: a connector that imported 3 of its 5 tools looks complete. These two
-- columns are the only record that the action list is partial.
--
-- NULLABLE, and the entity fields are Integer rather than int, deliberately:
-- ConnectorLibraryService.deploy() saves this row on every deploy. With
-- primitives, Hibernate would stamp 0/0 onto rows the backfill has never
-- touched, and "NULL means never back-filled" would be destroyed by ordinary
-- traffic within a day.
--
-- Additive only: two nullable columns, nothing else touched, no backfill.
ALTER TABLE connector_deployment
    ADD COLUMN tools_reported_by_meta INT NULL AFTER tool_sync_error,
    ADD COLUMN tools_imported INT NULL AFTER tools_reported_by_meta;
