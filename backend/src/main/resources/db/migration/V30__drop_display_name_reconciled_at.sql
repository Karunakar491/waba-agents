-- TASK-063/066 reverted (2026-07-30): verified_name-based displayName
-- auto-resolution was found to collapse multiple distinct client businesses
-- into one indistinguishable label — removed entirely. This column has no
-- remaining reader/writer.
ALTER TABLE agent DROP COLUMN display_name_reconciled_at;
