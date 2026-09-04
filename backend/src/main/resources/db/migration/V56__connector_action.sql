-- 2026-09-04. Action templates for a library connector.
--
-- Why this table has to exist: Meta scopes a connector's tools to a phone
-- number (/{phoneNumberId}/agent_connectors/{connectorId}/tools). So a connector
-- sitting in our library, not yet deployed to any agent, has its actions stored
-- NOWHERE — there is no Meta object to hold them. That is why the library page
-- has always been able to define a connector but never what it can do, and why
-- the wizard produces connectors that cannot be called.
--
-- This holds the template. Deploying a connector to an agent instantiates each
-- row as a real Meta tool. Editing a row does NOT touch a running agent — each
-- deployment reports whether it is behind, and updating is deliberate. Silently
-- rewriting a live client's agent behaviour is not something we should be able
-- to do by accident.
--
-- request_definition is stored as JSON verbatim, exactly as Meta accepts it,
-- rather than decomposed into columns. Its shape is Meta's and it is richer than
-- it looks: nested body nodes are recursively JSON-encoded strings, parameters
-- carry bindings and enums (see docs/meta-api/connector-tools-capability-matrix.md).
-- Modelling that in SQL would buy nothing and would need migrating every time
-- Meta adds a field.
--
-- Additive only: new table, no existing column touched.
CREATE TABLE connector_action (
    id BIGINT NOT NULL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    connector_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(1024) NOT NULL,
    request_definition JSON NOT NULL,
    user_auth_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    -- Meta rejects two tools with the same name on one connector, so catch it
    -- here rather than letting the operator find out at deploy time.
    CONSTRAINT uk_connector_action_name UNIQUE (connector_id, name),
    CONSTRAINT fk_connector_action_connector FOREIGN KEY (connector_id)
        REFERENCES connector (id) ON DELETE CASCADE
);

CREATE INDEX idx_connector_action_account ON connector_action (account_id);
