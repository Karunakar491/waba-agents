# Connectors — the workbench can be embedded, not just routed to

## Job

Groundwork for R4/R6 slice 4: the wizard's Connectors step is about to reuse
the same connector editor as the Connectors section, instead of its own
hand-rolled form. This step makes `ConnectorWorkbenchPage` embeddable —
`connectorId`/`actionId` can come from a caller's own state instead of the
URL, and every internal move calls the caller's `onNavigate` instead of
routing the browser — with **no behaviour change for the existing route**.
Nobody sees anything different yet; the wizard wiring is the next commit.

## Proof

Type-checks clean (`npx tsc --noEmit`, exit 0). No behaviour change for the
unembedded page — every `navigate(...)` call site now goes through a `go()`
helper that, when `embedded` is not passed, produces the exact same path and
the same push/replace choice it always did (checked call site by call site
against the pre-change code). Real-app proof that the *section* still works
exactly as before is owed before deploy, alongside the rest of this slice.

## Notes

- `onOpenOnAgent` (the sidebar's "open on agent" link for an orphan
  connector) deliberately always does a real route navigation, even
  embedded — it leaves to a different agent's page entirely, which is not
  part of either flow's own state.
- The breadcrumb that used to be a `<Link to="/library/connectors/:id">`
  is now a button that calls `go()` — a real link would have routed the
  wizard away from itself when embedded.
