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

## Proof

Deployed to production as `index-BqTeOTjh.js`, md5
`0481b7d817558a45e4f2eec289983d54`, verified served by nginx and referenced by
the live `index.html`.

Against production, after the deploy:

- `@workbench` — 1 passed. Asserts all five connector tabs, that Variables
  lists Meta's macros, that an action's Authorization reports what it inherits,
  and that the Still-needed line names the Docs tab.
- `@nested-body`, `@multi-auth` — 2 passed.
- `@connector-delete`, `@feedback` — 5 passed.
- Default suite — 12 passed.
- `tsc --noEmit` clean, `oxlint` clean on every changed file, 82 unit tests pass.

Screenshots at 1440x900 in `frontend/e2e-shots/wb-*.png`.

Two of my own test bugs found on the way:

- `shots-workbench.spec.ts` pointed at the deleted list page's links, so it
  could only ever have photographed an empty state. Deleted, not patched.
- The replacement waited on `networkidle` after selecting a connector, which
  proves nothing — the actions query starts *after* the selection. It now waits
  for the pane to have decided, and skips out loud rather than green when no
  connector on the account has an action, which is true today.
