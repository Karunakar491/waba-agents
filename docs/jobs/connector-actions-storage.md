# Somewhere to keep what a connector can do

## Job

Whoever connects a business API opens the Connectors section deciding "what can
this API do for my agent?" — and today there is nowhere to answer, because Meta
scopes tools to a phone number, so a connector that has not been deployed has
its actions stored nowhere at all; after this the library holds the actions, and
the edit page has something to show.

## Proof

`mvn -o test -Dtest=ConnectorLibraryServiceTest,MetaApiErrorMessageTest` —
**16 passed**. `mvn -o compile` clean.

Four of the new tests cover the things that would actually hurt:

- **An action id alone is not enough.** `findByIdAndConnectorId` is what stops
  one account reading another's action by guessing an id; the test asserts a
  `NotFoundException` and that nothing is deleted.
- **`accountId` comes from the connector, never the request** — asserted on the
  captured entity, so a caller cannot plant someone else's account id.
- **A duplicate action name is refused with the name in the message**, rather
  than letting Meta reject it at deploy time with a 409.
- **A nested request definition survives storage byte-for-byte.** Meta requires
  nested body nodes as recursively JSON-encoded *strings*; the test asserts the
  escaped inner node is still escaped after a round trip, and that it comes back
  out as real JSON rather than a quoted string.

Not yet proven against the running app: the migration has not been applied to
production and no UI reads these endpoints. That is the next job, and this one
should not be called done until the page uses it.

## Notes

Phase 1 of `docs/superpowers/specs/2026-09-04-connector-edit-page-design.md`.

`V56__connector_action.sql` is additive — new table, no existing column touched,
so it satisfies the additive-only migration rule and needs no backfill.

`request_definition` is stored as verbatim JSON rather than decomposed into
columns, because its real shape is richer than it looks (recursively string-
encoded nested nodes, bindings, enums — see
`docs/meta-api/connector-tools-capability-matrix.md`) and would otherwise need a
migration every time Meta adds a field.

Editing an action deliberately does NOT touch a running agent. Deploying
instantiates; a later edit leaves live agents alone and should surface as "this
agent is running an older version". Silently rewriting a live client's agent from
a library screen is the failure mode this avoids.
