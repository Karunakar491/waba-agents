-- Task A: Create Agent wizard fields (spec section 4).
-- All nullable — existing agents migrate as-is, no backfill.
ALTER TABLE agent
    ADD COLUMN customer_facing_name VARCHAR(25) NULL,
    ADD COLUMN channel ENUM('whatsapp', 'messenger', 'instagram') NULL,
    ADD COLUMN tone VARCHAR(50) NULL,
    ADD COLUMN language VARCHAR(50) NULL,
    ADD COLUMN behavior_rules TEXT NULL;
