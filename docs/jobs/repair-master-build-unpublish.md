# Repair master build: land the Unpublish/Draft feature

## Job

Anyone cutting a branch or running a deploy opens a clean checkout deciding
whether they can trust it; they see a frontend that builds, because
`AgentDetailPage.tsx` no longer imports three files that don't exist.

Secondary, for the operator: an Unpublish action on Skills, UI Skills and FAQ
that takes a capability off the live agent without destroying its content, and
a Drafts section to bring it back.

## Proof

Verified before this job started, and to be re-verified after:

- `git grep UnpublishConfirmModal master -- frontend/src` → import at
  `AgentDetailPage.tsx:44`; `git ls-tree master` → file not tracked. Confirmed
  independently, not taken from the `a129985` commit note.
- The `iris/phase-1-agent-creation-tools` worktree is missing the same three
  files, so the break is inherited by every branch cut from master.

After landing, both verified with all 68 uncommitted files stashed away so the
tree was exactly master — `npx tsc --noEmit` exit 0 and `mvn -o compile` exit 0.
Full transcript, including the independent confirmation of the break and the
restoration count, in
[docs/e2e-test-runs/2026-09-03-master-build-repaired.md](../e2e-test-runs/2026-09-03-master-build-repaired.md).

Not proven: nothing here shows Unpublish working against a live agent, and V54
has not been run anywhere.

## Notes

Why this is split across four commits rather than one: the whole feature is 722
backend + 282 frontend lines, over the 400-line cap the gate enforces. Split at
seams that each leave the tree coherent — schema/persistence, then service +
controller + sweep job, then tests, then frontend last.

**Frontend goes last deliberately.** Landing only the three missing frontend
files would fix the build while shipping an Unpublish button that calls backend
endpoints not yet on master — a lying UI, which is the exact class of defect
this whole overhaul exists to stop. Backend first means no commit in the
sequence ships an affordance that doesn't work.

Root cause of the original break is process, not code: the work was finished
and reviewed, then only half of it was committed. Nothing in the old nine-gate
process checked that the tree still built from a clean checkout — see
[[project-process-overhaul-2026-09-03]]. Adding that check to the commit gate
is the follow-up.
