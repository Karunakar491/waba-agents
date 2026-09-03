-- Additive only (Kill Switch discipline): new nullable column, no rename, no drop.
-- Lets the Inbox thread link a message back to the exact webhook_raw row that
-- produced it. Nullable and unbackfilled by design — the originating webhook
-- can't be reliably derived for historical rows, so old messages just won't
-- show the link affordance in the UI.

ALTER TABLE messages
    ADD COLUMN webhook_raw_id BIGINT NULL;
