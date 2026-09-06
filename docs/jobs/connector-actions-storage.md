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

### Applied to production, after taking it down first

The first version of `V56` declared `connector_id BIGINT` while `connector.id`
is `bigint unsigned`. MySQL refuses a foreign key whose column type differs from
its target's even by signedness, so the `CREATE TABLE` was rejected — and
because MySQL DDL is not transactional, Flyway recorded V56 as failed and every
subsequent boot aborted on "Detected failed migration to version 56". The
backend crash-looped and production returned 502 for about four minutes.

Recovered by stopping the service, deleting the single failed history row
(`DELETE FROM flyway_schema_history WHERE version = 56 AND success = 0`),
restoring `platform-ROLLBACK-20260904091116.jar`, and restarting — login 200 and
agents 200 verified before moving on. A verified-restorable backup existed
first: `/tmp/meta_agent_db-pre-V56-20260904090913.sql.gz`, gzip integrity OK,
39 tables.

The same mistake had already happened once on V50 (2026-08-13, also a lost
UNSIGNED), which is what makes it worth a container rather than a comment.
`FlywayMigrationsTest` now applies every migration to a real MySQL and asserts
no history row is left failed, plus that `connector_action.connector_id` matches
`connector.id` exactly — signedness included. Nothing in the build could have
caught this before: unit tests mock the repositories and `mvn package` never
touches a database.

After the fix: `SELECT version, success FROM flyway_schema_history WHERE
version = 56` → `56  1`; `SHOW CREATE TABLE connector_action` confirms all three
ids `bigint unsigned` and the foreign key present; the log reads "Successfully
applied 1 migration to schema meta_agent_db, now at version v56" and "Started
PlatformApplication in 29.922 seconds" with no errors.

### The page is live and proven against production

Deployed 2026-09-06. Bundle `index-BR68uNRG.js`, md5
`04b8591faf2a5f38a0e2c0bb19f82e91` — identical local and on the server, and it
is the bundle `index.html` actually references. `/library/connectors` 200,
`/api/v1/connector-library` 401 unauthenticated as expected.

`e2e/connector-edit-page.spec.ts` (`@connector-edit`) — **2 passed** against
production, logged in as a real user:

- **Edit opens a URL of its own** (`/library/connectors/{id}`), with "Where it
  is" and "What it can do" both present. That is the whole point of the change:
  not an inline panel, and not a detour through an agent.
- **A connector with no actions says so** — "This connector can't do anything
  yet" — rather than showing an empty section that reads as configured.
- **The action editor opens on four fields**, and "Headers" is genuinely absent
  from the DOM until Advanced is clicked. The collapse is asserted, because it
  is the reason the page is usable rather than a wall of panels.

The spec is read-only and tagged out of the default suite: these are real
connectors on a shared production box, so it opens and reads but never creates,
edits or deletes.

The swap was done assets-first, `index.html` last, with no `rm -rf` — so no
user could be served a half-updated app, and the previous `index.html` is kept
as `index.html.rollback-20260906`. Asset filenames are content-hashed, so the
old bundle stays on disk for anyone mid-session.

### Still not done

Saving an action stores a template and nothing more — nothing instantiates it as
a real Meta tool on deploy yet. Until that exists, a user can define an action,
see it listed, and still have an agent that cannot call it.

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
