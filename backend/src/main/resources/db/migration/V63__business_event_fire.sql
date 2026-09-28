-- 2026-09-25. The ledger of every attempt to make an agent announce something.
--
-- A "business event fire" is one attempt to tell a customer, through their
-- agent, that something happened on the business's side: the order shipped, the
-- refund cleared, the appointment moved. Every attempt gets a row here,
-- INCLUDING the ones we refuse before Meta is ever called. A refusal that is
-- not written down is a support ticket nobody can answer, and the founder's
-- "31 sent, 2 didn't" line is only truthful if the 2 exist as rows.
--
-- The one design point worth reading before touching this table:
-- OUTCOME AND META_STATUS ARE TWO COLUMNS ON PURPOSE.
--
--   outcome is OUR verdict on the attempt: REFUSED (we never called Meta),
--   ACCEPTED (Meta took it), FAILED (the call itself errored).
--   meta_status is META'S verdict on what it then did with it, polled
--   afterwards: request_received / processing / sent / failed / skipped /
--   success.
--
--   These disagree, routinely. "outcome = ACCEPTED, meta_status = skipped" is
--   real and common: Meta accepted the request, decided on its own not to
--   deliver anything, and the customer was never told. Collapse the two into
--   one status column and that row becomes indistinguishable from a genuine
--   delivery — the operator sees a green tick for a message that does not
--   exist. Skipped is the outcome that looks like success and isn't, and it is
--   only visible because the two columns are kept apart.
--
--   Same reasoning as V57 splitting tool_sync_error from last_error: two
--   different actors can fail at two different stages, so they get two columns
--   and nobody has to parse a string to tell them apart.
--
-- account_id is a COLUMN, not something inferred from a SecurityContext. The
-- inbound public path that fires these carries an ingest credential, not a
-- logged-in user, so there is no SecurityContext to read the tenant from. It
-- has to be on the row or tenant scoping cannot be enforced at all.
--
-- conversation_id is nullable and the NULL is evidence, not an omission: it is
-- exactly what a NO_CONVERSATION refusal looks like. Meta can only announce
-- into a conversation that already exists; if the customer never wrote in,
-- there is nothing to announce into, and the row records that with a NULL
-- conversation and refusal_reason = NO_CONVERSATION.
--
-- business_event_id and business_event_binding_id are nullable because this
-- table ships BEFORE the event library exists — there is nothing yet for them
-- to point at. They stay nullable forever after that too: an ad-hoc fire, one
-- that names its own event type and description rather than reusing a library
-- definition, is legal and will remain legal.
--
-- request_payload is TEXT, not JSON. Meta treats it as an opaque string capped
-- at 4096 characters and never requires it to parse; a JSON column would reject
-- a payload Meta itself would have accepted.
--
-- Additive only: new table, no existing column touched, no backfill.
-- BIGINT UNSIGNED on every id and FK column, not BIGINT. MySQL refuses a
-- foreign key whose column type differs from its target's even by signedness,
-- and V56 failed against production on 2026-09-04 for exactly this — Flyway
-- recorded the migration as failed and every subsequent start aborted on
-- "Detected failed migration to version 56" until the row was repaired.
CREATE TABLE business_event_fire (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    account_id BIGINT UNSIGNED NOT NULL,
    agent_id BIGINT UNSIGNED NOT NULL,
    -- NULL is the evidence of a NO_CONVERSATION refusal, see header.
    conversation_id BIGINT UNSIGNED NULL,
    -- Exactly what we sent Meta, after normalisation, so a support question can
    -- be answered without re-deriving it from the conversation.
    to_phone VARCHAR(32) NOT NULL,
    -- INBOUND_API / MANUAL / CONNECTOR_WATCH.
    source VARCHAR(24) NOT NULL,
    -- The user who pressed the button, for a MANUAL fire only.
    fired_by BIGINT UNSIGNED NULL,
    -- Which credential authenticated an INBOUND_API fire, so a leaked key's
    -- blast radius is a query rather than a guess.
    ingest_key_id BIGINT UNSIGNED NULL,
    business_event_id BIGINT UNSIGNED NULL,
    business_event_binding_id BIGINT UNSIGNED NULL,
    idempotency_key VARCHAR(128) NULL,
    -- Lengths are Meta's own limits on the agent_event contract, not ours.
    request_event_type VARCHAR(256) NOT NULL,
    request_description VARCHAR(1024) NOT NULL,
    request_payload TEXT NOT NULL,
    -- OUR verdict: REFUSED / ACCEPTED / FAILED.
    outcome VARCHAR(16) NOT NULL,
    refusal_reason VARCHAR(40) NULL,
    refusal_detail VARCHAR(512) NULL,
    -- Optional in Meta's contract — an accepted fire may come back without one,
    -- and then it can never be polled.
    meta_agent_event_id VARCHAR(255) NULL,
    meta_http_status INT NULL,
    meta_error_title VARCHAR(255) NULL,
    meta_error_detail VARCHAR(1024) NULL,
    meta_error_type VARCHAR(64) NULL,
    -- META'S verdict, polled. Deliberately separate from outcome, see header.
    meta_status VARCHAR(24) NULL,
    meta_skipped_reason VARCHAR(512) NULL,
    meta_error_message VARCHAR(512) NULL,
    poll_attempts SMALLINT NOT NULL DEFAULT 0,
    last_polled_at DATETIME(6) NULL,
    -- Set once Meta's status can no longer change; the poller skips these.
    terminal_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    -- A retried fire must not announce the same thing twice to a customer.
    -- Scoped to the agent because a key is only ever unique within its caller.
    CONSTRAINT uq_fire_idem UNIQUE (agent_id, idempotency_key)
);

-- The agent's own history list, newest first.
CREATE INDEX idx_fire_agent_created ON business_event_fire (agent_id, created_at);

-- The scheduled poller's claim query: non-terminal rows due another check.
CREATE INDEX idx_fire_poll ON business_event_fire (meta_status, last_polled_at);
