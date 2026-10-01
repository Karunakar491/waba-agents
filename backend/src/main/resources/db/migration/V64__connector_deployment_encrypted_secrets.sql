-- Stores a deployment's credentials encrypted at rest (AES-256-GCM via
-- SecretEncryptor), so a later redeploy to the same agent can reuse them
-- instead of asking the operator to re-type a key every time. Nullable and
-- additive: a deployment made before this exists simply has no stored
-- secrets, and its next deploy still requires them supplied once.
ALTER TABLE connector_deployment
    ADD COLUMN encrypted_secrets TEXT NULL AFTER tool_sync_error;
