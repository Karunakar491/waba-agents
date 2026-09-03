---
date: 2026-09-03
type: incident
tags: [build, master, process-debt, deployment, uncommitted-work, em-review]
status: active
---

# master HEAD has been un-buildable for 9 days (dangling unpublish imports)

## Context
Found while preparing a routine one-file frontend deploy (the Create Agent Step 1 "number already taken" fix, `2aee0f3`). Building from a clean, isolated worktree at master HEAD failed immediately with `TS2307: Cannot find module`.

## Decision / Event
**Master cannot compile from a clean checkout, and has not been able to since 2026-08-25.**

Commit `e5ba0ba` ("feat: support path/query/header/body parameters and full edit for connector tools", 2026-08-25 14:39 IST) committed three import lines into `frontend/src/pages/AgentDetailPage.tsx`:

```
import UnpublishConfirmModal from '../components/agent-detail/UnpublishConfirmModal'
import DraftsDisclosure from '../components/agent-detail/DraftsDisclosure'
import { useUnpublishFlow } from '../components/agent-detail/useUnpublishFlow'
```

None of those three files were ever committed. Verified with `git cat-file -e master:<path>` — all three absent from git, present only as untracked files in the founder's working tree. The backing migration `V54__unpublish_draft_status.sql` is likewise untracked.

**22 commits have landed on master since, none of which could have been built from a clean tree.**

Why it went unnoticed: the founder's own working tree *does* contain the untracked files, so local builds succeed there. Only a clean checkout or isolated worktree exposes it.

## Impact
- Every frontend deploy since 2026-08-25 has required a hand-applied, uncommitted strip of the dangling unpublish wiring to produce a bundle. This deploy was the **5th occurrence** (4x on 2026-08-25, 1x earlier on 2026-09-03, now this one).
- **What is deployed to production does not correspond to any git commit.** It is master HEAD *minus* never-committed wiring. That is a real traceability gap: "which commit is live" has no exact answer right now.
- Each hand-application carries transcription risk. This time the strip was 33 deletions across 5 sites in one file (imports, `useUnpublishFlow` hook call, the Unpublish button, `<DraftsDisclosure>`, `<UnpublishConfirmModal>`, plus reverting `faqs` to unfiltered).
- Anyone else cloning the repo cannot build the frontend at all.

## Rationale (why it was worked around rather than fixed in this deploy)
Fixing master properly means either (a) finishing and committing the unpublish feature — which PM/UX/EL previously found real problems with (unsafe Delete-button asymmetry, no feature flag, wrong button styling, diff-size violation) and which is not reviewed or approved, or (b) reverting the dangling imports, which touches the founder's in-progress uncommitted work in the same file.

Neither belongs bundled into an unrelated one-file bug-fix deploy. Scope discipline (CLAUDE.md: "never touch files outside the current task's scope") says work it as its own task with EM involvement.

Confirmed safe to strip for this deploy: the live production bundle contained no `Unpublish` string before this deploy, so the feature was **never live** — stripping removed nothing from production rather than silently deleting a shipped feature (which would have needed founder sign-off per the CrossWabaHealthStrip precedent).

## Expected Outcome
Deploy #6 should not need this workaround. Recommended to EM, pick one:
1. **Revert the dangling imports on master** (smallest, unblocks builds immediately; unpublish stays untracked WIP in the founder's tree), or
2. **Finish the unpublish feature through the normal gates and commit it whole** (imports + 3 components + V54 migration together).

Either way master must build from a clean checkout before the next frontend deploy, so that "what's live" maps to a real commit again.

## Actual Outcome
Not yet addressed as of 2026-09-03. Logged for EM decision. Tracked as TASKS.md #18.

## Related
- [[../deployment/2026-09-03-stepbasics-fix-deploy|StepBasics fix deploy record (2026-09-03)]] — the deploy that surfaced this
- [[../deployment/2026-08-25-session/frontend-deploy-runbook|Frontend Deploy Runbook]] — the runbook this workaround sits outside of
