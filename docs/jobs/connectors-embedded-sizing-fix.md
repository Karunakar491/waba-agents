# Connector workbench — fix embedded sizing (missed piece)

## Job

Small fix left uncommitted from the embeddable-workbench work: the outer
`-m-6` (negative margin, cancelling the page shell's padding) only makes
sense for the routed page. Embedded — the wizard step and the agent tab —
there is no shell padding to cancel, so it must fill the caller's own
bounded box (`h-full`) instead, or the workbench visually bleeds past the
border both callers already draw around it.

## Proof

Type-checks clean against the real build (`npx tsc -b --force`, exit 0).
Visual proof (does it actually sit inside the box, not bleeding past it) is
owed alongside the rest of this slice's real-app verification.

## Notes

Caught by `node scripts/parallel.js status` reporting uncommitted shipped
code before starting the deploy verification pass — this was made while
designing the wizard's box height, then not re-staged in the later
wizard/agent-tab commits that only touched their own files.
