# Audit the product against what a user actually experiences

## Job

The founder asked for an audit of every screen — "Check the Skills, connectors,
Inbox, Debug, everything dude, Every single thing" — and then for it to be
judged against Apple's UX principles rather than returned as a defect list.

Two documents come out of it:

- `docs/audit/2026-09-06-product-audit.md` — what exists, what is broken, what
  is missing, screen by screen.
- `docs/audit/2026-09-06-ux-principles-audit.md` — whether it would pass a
  principled review: feedback, forgiveness, consistency, recognition over
  recall, clarity, user control, direct manipulation, progressive disclosure,
  deference.

## Proof

No behaviour changed, so there is nothing to verify in the running app beyond
the evidence the documents already carry.

The evidence itself: both audits were taken from production, logged in as a real
user, walking all 19 screens and recording every failed request, console error,
button and link. `frontend/e2e/tools/full-audit.spec.ts` (`@audit`) and
`audit-deep.spec.ts` (`@audit2`) hold that walk. They assert nothing — they
cannot go red and be ignored — and are excluded from every suite.

The strongest finding is source-counted rather than observed, so it does not
depend on the walk: **77 mutations in the frontend, and exactly one visible
success confirmation** (`BusinessProfileTab.tsx:155`), against `ErrorBanner`
used in 42 files. The app is articulate about failure and mute about success.

Stated limits, recorded in the document itself: no flow was completed end to
end, and no screen was looked at — the DOM was read as text.
