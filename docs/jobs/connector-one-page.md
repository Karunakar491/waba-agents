# Connector page: one page, no sections

## Job

Make the connector page match the approved artboard (`design/Main.dc.html`): a
single scrolling page — name, description, tags, base URL and auth at the top,
then the Actions table, then the agents running it, then Meta's variable list as
a footnote.

Remove the five-pill section nav from the header. A connector holds ~7 fields, a
static macro list and a deployment fact. Navigation was invented to fill a
screen, and it cost two review rounds ("why are there 2 tabs", "when someone
clicks on actions why are other sections closed?"). Nothing here needs to be
found; it needs to be read top to bottom.

Scope is the connector page only. The action page (base URL + auth shown per
action, Send/Response, one shared table component) is the next job.

## Proof

- `npm run build` clean — `tsc -b`, not `npx tsc --noEmit`, which misses
  project-reference errors.
- Playwright: the connector specs that assert on `connectorSection()` have to
  stop doing so, because the nav they scope to is gone. `workbench`,
  `nested-body`, `multi-header-auth`, `connector-delete`, `action-feedback`.
- Every section's content still reachable without a click: Details, Auth,
  Actions, Variables, Agents all on the page at once.
- `?section=` no longer read anywhere — grep for it.
