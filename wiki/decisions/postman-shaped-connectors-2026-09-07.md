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

## Follow-up, same day

The founder, on seeing it: "that add an action is always an extra step dude.
Instead we will show it as body and by default details should open."

- A connector opens on `Details`. Actions led with a table that is empty on
  every connector that has just been created.
- On a connector with no actions, selecting `Actions` opens the request editor
  directly — no button, no empty state.

**The failed first attempt is the lesson**: rendering the editor *inside* the
Actions tab put two rows of tabs on screen, one under the other, both reading
Authorization / Headers / Body. Nested tab rows are the tab-shaped version of
nested card chrome — it was worse than the button it removed. The editor opens
as its own view instead, the same one the tree reaches, so there is one editor
and not two.

## Second follow-up: the sections had to leave the pane

"When someone clicks on actions why are other sections closed?" They were not
closed — they were gone. The section row lived inside the pane, and opening an
action replaces the pane, so Details / Authorization / Variables / Agents all
disappeared and the sidebar was the only way back. The row moved into the
header.

Three things broke on the way, and each is a general trap:

1. **Two tablists, one screen.** The connector's row and the action's row both
   contained "Authorization" and "Headers". Ambiguous to a person, and a
   `getByRole('tab', { name: 'Authorization' })` selector matched two elements
   and failed on a screen that worked. Fix: the header is a labelled `nav` with
   `aria-current`, the action's row stays the tablist — which is what each one
   actually is. Specs address the header through one helper,
   `connectorSection()`.
2. **State does not survive a route change.** `/library/connectors/:id` and
   `/library/connectors/:id/actions/:actionId` are separate routes, so moving
   between them unmounts the page. The section reverted to Details on the way
   back from an action. It lives in `?section=…` now. See
   `wiki/lessons/frontend-patterns.md` on unmount races.
3. **`x?.length === 0` is false while `x` is undefined.** Deciding on the click
   whether Actions means the table or the editor read the actions before the
   query answered, so a click during loading landed on an empty table. Decided
   in an effect guarded on the data being present.

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
