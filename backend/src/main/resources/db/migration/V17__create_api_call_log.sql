CREATE TABLE api_call_log (
    id              BIGINT UNSIGNED NOT NULL,
    account_id      BIGINT UNSIGNED NULL, -- nullable: not every Meta call happens inside an authenticated request
    method          VARCHAR(10) NOT NULL,
    path            VARCHAR(512) NOT NULL,
    status_code     INT NULL,             -- null when the call never got a response (network/timeout)
    duration_ms     BIGINT NULL,
    request_body    TEXT NULL,            -- redacted JSON, truncated
    response_body   TEXT NULL,            -- redacted JSON, truncated
    error_message   VARCHAR(1000) NULL,
    called_at       DATETIME NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_api_call_log_account_time (account_id, called_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
