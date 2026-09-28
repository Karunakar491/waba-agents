# One session touches production at a time

## Job

Two people open two chats on the same repo and each build a different part of
the product. Neither has to wonder whether the other is mid-deploy: the second
one to reach for production is stopped and told who holds it, what they are
doing and since when — instead of finding out an hour later that their work is
no longer live.

Founder, 2026-09-24: *"There are 2 parallel agents working on the same code.
Please ensure that your build and their build are not clashing. Please prepare a
process like that so that multiple chats can be opened and each chat can work on
each sub part"*.

This is harness work, not a product requirement, so it does not run the seven
stages in `docs/REQUIREMENTS-PROCESS.md`.

## Proof

Produced 2026-09-24. The guard driven through its cases with real hook payloads:

```
1 read-only curl                    -> ALLOW
2 command that only mentions deploy -> ALLOW
3 session A really restarts         -> ALLOW   (takes the lock)
   lock now: HELD
4 session B tries to swap bundle    -> DENY: another session is deploying right now
5 session A again (its own lock)    -> ALLOW   (re-entrant)
6 upload from a dirty worktree      -> DENY: 22 uncommitted changes to shipped code
```

Case 4's message names the holder, the worktree, the age and how to release it.
Case 6 lists the offending files and gives the worktree command to build from a
commit instead.

`node scripts/parallel.js status` after release:

```
deploy lock: D:\Meta business agents\.git\parallel-deploy-lock.json

FREE — nobody is touching production.
```

**A false positive found and fixed while testing.** The first version matched on
command text alone, so a command that merely *quoted* `systemctl restart
metaagent` — a test payload, a runbook, a report — took the lock and would have
blocked the next session. A production write now has to reach the box
(`ssh`/`scp`/`rsync` or the host address) as well as match. That is the same
class of bug as reading a heredoc as a command, which `git-guard.js` already
strips.

### Not tested

- Two genuinely concurrent sessions racing the same write. The lock is a
  read-then-write on one file with no atomic compare-and-set, so two sessions
  landing inside the same few milliseconds could both proceed. Deploys are
  minutes apart in practice, and the file is a lock, not a transaction.
- A session on a different machine. The lock is in this repo's git common dir,
  which covers every worktree here and nothing beyond it.

## Notes

- **The lock lives in the git common dir**, not the working tree. Worktrees do
  not share untracked files, so a lock in the tree would be invisible to exactly
  the sessions it is meant to stop. `git rev-parse --git-common-dir` resolves to
  the same path from every worktree.
- **Taken automatically by the first production command**, not by a command
  somebody has to remember. A lock you must claim by hand is a lock that is
  forgotten on the day it matters.
- **Released explicitly, expires after 60 minutes.** `break` refuses a live
  lock — breaking one is the collision this prevents.
- **Reads are never blocked.** A guard that made "what is live right now?"
  harder would make production less safe.
- The written half of the process — one worktree per session, claiming an area,
  recording what went live — is in `docs/PARALLEL-SESSIONS.md` and is not
  enforceable. Nothing can tell whose uncommitted edit is whose.
