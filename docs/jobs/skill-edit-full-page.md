# Move skill editing out of the cramped modal

## Job

Someone writing or reviewing an agent's skill instructions opens the editor
deciding whether the wording is right; they see the full instruction text in a
page-sized editor instead of an eight-row textarea inside a `max-w-lg` dialog
that showed a few hundred of several thousand characters at a time.

## Proof

- `npx tsc --noEmit` exit 0.
- Post-deploy: `/library/skills/:skillId/edit` loads a real skill, shows its
  full body, and saves.

Recorded in `docs/e2e-test-runs/`.

## Notes

Founder-caught gap, 2026-08-14. Real skill instructions routinely run several
thousand characters; the modal made them unreviewable.

Behaviour change an operator will notice: Edit now **navigates** rather than
opening a dialog, so the browser Back button becomes part of the flow. Leaving
mid-edit is a page exit, not a modal dismiss — there is no unsaved-changes
guard, which is a follow-up worth filing rather than a blocker (the old modal
had none either).
