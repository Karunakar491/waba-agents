# Connectors — scope the agent tab, and stop calling it a Library

## Job

A support lead opens an agent's Connectors tab expecting to see only what's
deployed on that agent. Today they see every connector on every agent that
shares the account's WABA — Astrotalk 85916 showed `smsabotapi`,
`dealer_locator_api`, none of them its own. They decide whether that agent
is correctly configured; a list that's really the whole account's inventory
makes that decision impossible to make correctly.

Same visit, a second problem: the screen and the code call this a "Library"
— controller, service, DTOs, API route, on-screen copy. A library is
somewhere you browse and read, not somewhere you create, deploy and delete
things. The founder flagged this by name; it's fixed everywhere in this
domain, backend and frontend, so the next person reading the code isn't
told a different story than the one on screen.

## What changed

- `WorkbenchSidebar`/`ConnectorWorkbenchPage`: the agent tab now defaults to
  only the connectors actually deployed on that agent (checked via each
  connector's own `deployments` list — no new API call). "Browse all
  connectors" toggles to the full account list to import one not yet here;
  publishing from that view returns you to the agent-scoped list.
- The "live on an agent, not in our records" section is scoped to the one
  agent being viewed, not every agent's orphans.
- `ConnectorLibraryController/Service/Dtos` → `ConnectorController/Service/
  Dtos`; API route `/connector-library` → `/connectors`. The pre-existing
  Meta-mirror endpoint that used to sit at `/connectors` moved to
  `/connectors/live` (renamed class: `ConnectorMirrorController`) so the two
  don't collide.
- `publishedToLibrary`/`libraryConnectorId` (Java field + DTO field, both
  frontend and backend) → `connectorDefined`/`connectorId`. The underlying
  DB column (`published_to_library`) is untouched — no schema change, no
  migration, just the Java/TS names reading it.
- Frontend `connectorLibrary.ts` → `connectors.ts`, `LibraryConnector` type
  → `Connector`.

## Proof

- Backend: `./mvnw -o compile` and `./mvnw -o test-compile` both exit 0.
  `ConnectorServiceTest` and `ConnectorBackfillSweepTest` pass (`./mvnw -o
  test -Dtest=...`).
- Frontend: `npx tsc --noEmit -p .` exits 0 across the whole rename.
- **Not proven**: the agent-scoping fix has not been driven through the
  real running app against a real agent (e.g. Astrotalk 85916) — no
  screenshot, no `npm run e2e` pass. Typecheck and unit tests prove the
  code compiles and the deploy/list logic behaves as unit-tested; they do
  not prove the screen renders correctly for a real user. That verification
  is still owed before this is called done end to end.

## Out of scope here

- The deeper "why do orphans exist" gap (mirror table updates on sync, but
  nothing ever creates the matching connector definition) — separate,
  already flagged, not touched by this job.
- Renaming `connector_library`-flavored naming in other domains (Skills,
  Business Events, Knowledge Base) — done as separate jobs on the main
  checkout, not this branch.
