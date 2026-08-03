-- Iris (Template Studio's chat assistant), 2026-08-04. BYOK AI-provider
-- credentials — closed-set provider/model enforced server-side (never trust
-- a frontend dropdown alone), account-scoped (a provider key is account-wide,
-- not per-WABA — matches how these keys are actually issued/used).
CREATE TABLE ai_provider_credential (
    id                BIGINT UNSIGNED NOT NULL,
    account_id        BIGINT UNSIGNED NOT NULL,
    provider          VARCHAR(20)     NOT NULL,
    model             VARCHAR(50)     NOT NULL,
    encrypted_api_key TEXT            NOT NULL,
    created_at        DATETIME        NOT NULL,
    updated_at        DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ai_provider_credential_account_provider (account_id, provider)
);

-- One conversation. waba_id nullable — a session may start before a WABA is
-- picked (e.g. general marketing chat) or be scoped to one once template
-- work starts.
CREATE TABLE iris_session (
    id               BIGINT UNSIGNED NOT NULL,
    account_id       BIGINT UNSIGNED NOT NULL,
    waba_id          BIGINT UNSIGNED NULL,
    -- The last tool call awaiting explicit user confirmation, if any — see
    -- IrisConversationService's pause/persist/confirm flow. NULL when there
    -- is nothing pending. Holds the exact args the tool will execute with;
    -- confirm always replays THESE args, never a freshly re-parsed model
    -- message, so a confirm can't silently diverge from what was previewed.
    pending_tool_name     VARCHAR(50)  NULL,
    pending_tool_args_json TEXT        NULL,
    created_at       DATETIME         NOT NULL,
    updated_at       DATETIME        NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_iris_session_waba FOREIGN KEY (waba_id) REFERENCES waba (id)
);

CREATE TABLE iris_message (
    id               BIGINT UNSIGNED NOT NULL,
    session_id       BIGINT UNSIGNED NOT NULL,
    role             VARCHAR(10)      NOT NULL, -- USER | ASSISTANT | TOOL
    content          TEXT             NOT NULL,
    tool_name        VARCHAR(50)      NULL,
    tool_args_json   TEXT             NULL,
    created_at       DATETIME         NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_iris_message_session FOREIGN KEY (session_id) REFERENCES iris_session (id),
    INDEX idx_iris_message_session (session_id)
);
