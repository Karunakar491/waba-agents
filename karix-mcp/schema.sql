-- karix-mcp persistence — drafts and bulk-import job tracking ONLY.
-- Approved/live templates are never stored here — they stay live-sourced
-- from Karix's own Template API (list_templates already works this way),
-- so there is exactly one source of truth for live template state.
--
-- MySQL, not Postgres — matches this org's infra standard.
-- Applied manually (this service has no migration framework); re-run is
-- safe via CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS template_drafts (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,   -- uuid4, app-generated
    esme_addr     VARCHAR(64)  NOT NULL,                -- tenant scope — matches JWT claim
    waba_id       VARCHAR(64)  NOT NULL,
    template_name VARCHAR(512) NOT NULL,
    payload_json  JSON         NOT NULL,                -- full Karix create_template payload
    status        ENUM('draft', 'submitted', 'submit_failed') NOT NULL DEFAULT 'draft',
    submit_error  TEXT         NULL,
    karix_template_id VARCHAR(128) NULL,                 -- set once Karix accepts it
    created_at    DATETIME     NOT NULL,
    updated_at    DATETIME     NOT NULL,
    INDEX idx_template_drafts_tenant (esme_addr, waba_id)
);

CREATE TABLE IF NOT EXISTS bulk_import_jobs (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    esme_addr     VARCHAR(64)  NOT NULL,
    waba_id       VARCHAR(64)  NOT NULL,
    filename      VARCHAR(255) NOT NULL,
    status        ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
    total_rows    INT          NOT NULL DEFAULT 0,
    processed_rows INT         NOT NULL DEFAULT 0,
    error         TEXT         NULL,
    created_at    DATETIME     NOT NULL,
    updated_at    DATETIME     NOT NULL,
    INDEX idx_bulk_import_jobs_tenant (esme_addr, waba_id)
);

CREATE TABLE IF NOT EXISTS bulk_import_rows (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    job_id        VARCHAR(36)  NOT NULL,
    row_number    INT          NOT NULL,
    raw_json      JSON         NOT NULL,                -- the spreadsheet row, as read
    status        ENUM('pending', 'valid', 'invalid', 'submitted', 'submit_failed') NOT NULL DEFAULT 'pending',
    errors_json   JSON         NULL,                     -- validator errors, if any
    karix_template_id VARCHAR(128) NULL,
    created_at    DATETIME     NOT NULL,
    updated_at    DATETIME     NOT NULL,
    CONSTRAINT fk_bulk_import_rows_job FOREIGN KEY (job_id) REFERENCES bulk_import_jobs(id),
    INDEX idx_bulk_import_rows_job (job_id)
);
