# Postman-shaped connectors

## Job

The founder: "the current layout is good but very confusing. People are used to
using postman only." Operators here are technical and already know Postman, so
the cost of our own arrangement is paid on every visit — they have to learn
where we put things.

Make both panes read like the tool they already know, without teaching anything
Meta does not do.

**Connector = Postman collection.** Tabs, not one long scroll:

| Tab | Holds | Postman equivalent |
| --- | --- | --- |
| `Actions` | the tools, as a table | the requests in a collection |
| `Details` | name, description, `base_url`, delete | collection Overview |
| `Authorization` | `auth_type`, `auth_config`, OAuth2, mTLS | collection Authorization |
| `Variables` | Meta's three macros, read-only | collection Variables |
| `Agents` | deployments + Publish | (no equivalent — Meta's own) |

**Action = Postman request.** Name on a breadcrumb line, method+path bar, then
`Params` / `Authorization` / `Headers` / `Body` / `Docs` / `Response`.

**Follow-up, same day, after the founder saw it:** a connector opens on
`Details`, not `Actions` — arriving at a connector, the connector is what you
are looking at, and Actions led with a table that is empty on every newly
created one. And "add an action is always an extra step": on a connector with
no actions, selecting `Actions` opens the request editor directly. The obvious
version — rendering the editor inside the tab — put two rows of tabs on screen,
both saying Authorization / Headers / Body, so it opens as its own view
instead. The button survives only where a table already exists to add to.

Deliberately **not** copied:

- **Collection-level Headers and Body.** Meta's connector object has neither.
  Postman merges collection headers into every request; doing that here would
  make an action's Headers tab show rows the user never typed there, and the
  merge would be ours, not Meta's. Headers stay per-action.
- **Scripts / Settings / Runs.** Meta's runtime makes the call. There is no
  pre-request script, no timeout knob and no run history to expose.
- **Editable full URL.** `base_url` belongs to the connector; every action under
  it shares one. Already the case, unchanged.

**Authorization tab on an action** is the one place copying Postman *helps*
accuracy: auth is only ever connector-level in Meta, so the tab exists and says
it is inherited, with a link to the connector — exactly Postman's "Inherit auth
from parent". A missing tab would leave the operator hunting for it.

Copy goes terse: `auth_type`, `binding`, `required`, not sentences. The
explanatory line stays only where it prevents a real mistake — a GET body is
silently dropped by Meta, and that is worth a sentence.

**Second follow-up:** "when someone clicks on actions why are other sections
closed?" They were not closed, they were gone — the section row lived inside
the pane, and opening an action replaces that pane. It moved into the header,
where it stays put wherever you are in the connector. Three consequences, all
of which broke something first: the row had to become *navigation* rather than
a second tablist (two tabs named Authorization on one screen); the section had
to move into the URL (`?section=…`, because the two routes remount the page and
`useState` reverted to Details); and "Actions on an empty connector opens the
editor" had to be decided after the actions load rather than on the click
(`actions?.length === 0` is false while `actions` is `undefined`).

## Proof

Deployed to production as `index-Da_nxP0b.js`, md5
`ece3282c161ae1b6e1cca8a238f8ba34`, verified served by nginx and referenced by
the live `index.html`. (Earlier bundles this job: `index-BqTeOTjh.js`,
`index-De7wZ0r6.js` — the nested-tabs attempt — then `index-BUn-dY0z.js`.)

Against production, after the deploy:

- `@workbench` — passes. Asserts all five connector sections, that a connector
  opens on Details, that selecting Actions on an empty connector lands in the
  request editor with no button pressed, that the connector's sections are
  **still visible while an action is open**, that returning to one lands on
  that section rather than reverting to Details, that Variables lists Meta's
  macros, that an action's Authorization reports what it inherits, and that the
  Still-needed line names the Docs tab.
- `@workbench`, `@nested-body`, `@multi-auth`, `@connector-delete`, `@feedback`
  — 8 passed together.
- Default suite — 12 passed.

The login rate limit ("Too many requests. Try again in 7 minutes") bit twice
during this job, once making all seven connector specs fail at the same time.
It is not a product fault, but it does mean a red run needs checking against
`error-context.md` before it is believed. `@handoffshot` logs in itself instead
of reusing the shared auth fixture, which is worth fixing.
- `tsc --noEmit` clean, `oxlint` clean on every changed file, 82 unit tests pass.

Screenshots at 1440x900 in `frontend/e2e-shots/wb-*.png`.

Two of my own test bugs found on the way:

- `shots-workbench.spec.ts` pointed at the deleted list page's links, so it
  could only ever have photographed an empty state. Deleted, not patched.
- The replacement waited on `networkidle` after selecting a connector, which
  proves nothing — the actions query starts *after* the selection. It now waits
  for the pane to have decided, and skips out loud rather than green when no
  connector on the account has an action, which is true today.
