# Connector edit page — design

## Job

Whoever wires a business API into an agent opens a connector deciding "will this
work, and will the agent use it correctly?"; today that answer lives across four
nested levels of `AgentDetailPage.tsx`, a wizard step that creates connectors with
no tools, and a library that cannot express behaviour at all — so this design
settles what a single edit page contains, and which of its four sections
(details, request, response, mapping) can actually be stored versus needing new
machinery.

## Proof

Design only — no runnable artifact, hence the `chore/` slug. The design itself is
`docs/superpowers/specs/2026-09-04-connector-edit-page-design.md`, and every claim
in its "Why now" section cites evidence produced earlier today:
`docs/meta-api/connector-tools-capability-matrix.md` and the screenshots in
`docs/e2e-test-runs/`.

Phase 0 of the design is the part that produces demonstrable proof, and it gets
its own job when it is built.

## Notes

Two decisions are deliberately left to the founder rather than assumed, because
both are expensive to reverse: whether the page edits reusable templates or is
always agent-scoped (Meta scopes tools per phone number, so this is forced), and
whether field mapping is advisory or enforced (enforced needs us in the request
path, holding partner credentials, which today we deliberately never store).
