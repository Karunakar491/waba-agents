-- TASK-062 (Files/Websites GET+reconcile, 2nd item of the TASK-061 backlog):
-- mirrors TASK-059's FAQ reconciliation shape. Unlike FAQ, addFile/addWebsite
-- already throw hard on a failed Meta write (no "local-only" save path
-- exists), so there is no metaSyncAttempted concept needed here — every row
-- only ever exists because its Meta create call already succeeded. The only
-- drift this catches is content changed/deleted directly on Meta outside
-- this app.
ALTER TABLE agent_file
    ADD COLUMN meta_synced BOOLEAN NOT NULL DEFAULT TRUE AFTER meta_file_id;

ALTER TABLE agent_website
    ADD COLUMN meta_synced BOOLEAN NOT NULL DEFAULT TRUE AFTER meta_website_id;

-- TTL gates so reconciliation doesn't call Meta on every single read (same
-- fix TASK-059's first attempt needed after an EL REJECT).
ALTER TABLE agent
    ADD COLUMN file_reconciled_at DATETIME NULL AFTER faq_reconciled_at,
    ADD COLUMN website_reconciled_at DATETIME NULL AFTER file_reconciled_at;
