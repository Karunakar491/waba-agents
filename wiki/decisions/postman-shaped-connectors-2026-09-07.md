---
date: 2026-09-07
type: design
tags: [connectors, ui-familiarity, meta-api, postman, workbench]
status: active
---

# Connectors laid out like Postman

## Context

The workbench had already taken Postman's *shape* — tree on the left, method
and path on one bar. The founder, looking at it: "the current layout is good
but very confusing. People are used to using postman only." Operators here are
technical and already know Postman, so our own arrangement of the same
information was a cost paid on every visit.

Also settled in the same message: these users do not need friendly language.

## Decision

Both levels tabbed, mapped onto Postman's own two levels.

Connector = collection: `Actions` (a table) / `Details` / `Authorization` /
`Variables` / `Agents`.

Action = request: `Params` / `Authorization` / `Headers` / `Body` / `Docs` /
`Response`. Name is the title, editable in place. Description moved to `Docs`.
Query params come before path params.

## What was deliberately NOT copied, and why

- **Collection-level Headers and Body.** Meta's connector object has neither.
  Postman merges collection headers into every request; doing that here would
  put rows in an action's Headers tab that nobody typed there, and the merge
  would be ours rather than Meta's. Headers stay per-action. This was the one
  question worth asking the founder, and the answer was to match Postman's
  *familiarity*, not to invent Postman's *features*.
- **Scripts, Settings, Runs.** Meta's runtime makes the call. No pre-request
  script, no timeout, no run history exists to expose.

## Where the mapping is not one-to-one

An action's `Authorization` tab **reports** rather than edits. Postman lets a
request override its parent's auth; Meta does not — `auth_config` lives on the
connector and a tool cannot carry a credential. The tab still exists, because a
missing one sends people hunting for it, and it links to the connector.

`Variables` is new rather than moved: Meta's macro set is closed
(`WHATSAPP_PHONE_NUMBER`, `WHATSAPP_IDENTITY_HASH`,
`WHATSAPP_CURRENT_STATUS_ID`) and was only discoverable inside a parameter's
fill dropdown.

## Consequences

- A required field now sits behind a tab (`Docs`). The Still-needed line beside
  Save names the tab — without it, Save is a dead button with no explanation.
  Any future field moved behind a tab owes the same.
- Delete moved to a connector's `Details`. Six specs clicked controls where they
  used to be; the shared fixture absorbed most of it.

## Related

- [[connector-workbench-2026-09-06]]
- `docs/jobs/postman-shaped-connectors.md` — the job and its proof
- `docs/meta-api/connector-tools.md` — why auth is connector-level only
