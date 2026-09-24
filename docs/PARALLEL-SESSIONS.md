# Working in parallel

Several chats can work this repo at once. Two did on 2026-09-24 and collided
twice before lunch. Neither collision was a mistake anybody made — both were the
same missing thing, so this file fixes the thing rather than asking people to be
careful.

What happened, because it is the whole argument:

- **Both deployed the frontend, twelve minutes apart.** The second build came
  from a branch that did not contain the first one's commits, so work that was
  live at 05:10 was gone by 05:22. Nobody was told. It was found by re-reading
  the ledger an hour later.
- **A jar build died mid-rename** in a worktree another session was editing. That
  was the lucky version: one commit further along it would have built cleanly
  and shipped somebody's unfinished controller to production under the wrong
  name, with no way to tell afterwards what was in the artefact.

## The four rules

### 1. One worktree per session. Never share one.

A worktree is one working tree with one HEAD. Two sessions in it are two people
editing the same file over each other, and a build takes whatever is on disk at
that second — finished or not.

```
git worktree add /d/wt-<slug> <branch>        # to work on a branch
git worktree add --detach /d/wt-build <sha>   # to build a known commit
```

Keep the path short: long Windows paths break the build.
`frontend/.env.production` is gitignored, so copy it into a new worktree or the
bundle points at `localhost:8080` and the app is dead.

`node scripts/parallel.js status` lists every worktree and who holds production.

### 2. One session touches production at a time.

Production is one box, one `/var/www/metaagent` and one jar, however many chats
are open. The first production command a session runs takes a lock; other
sessions are blocked until it is released or expires after 60 minutes.

This is enforced by `scripts/deploy-guard.js`, a PreToolUse hook. It is not
advisory and there is nothing to remember: the lock is taken for you.

```
node scripts/parallel.js status     # who holds it, and for how long
node scripts/parallel.js release    # hand production on — do this when done
node scripts/parallel.js break      # take a stale lock, deliberately
```

`break` refuses a lock that is still live. If you think a session has died,
check with `status` first and message it. Breaking a live lock is precisely the
failure this exists to prevent.

Reads are never blocked. Checking what is live, tailing a log or curling the
site is how you find out whether it is safe to act.

### 3. Never deploy an artefact built from a dirty tree.

Uploading a bundle or a jar from a worktree with uncommitted changes under
`frontend/src/` or `backend/src/main/` is blocked. Nobody can say afterwards
what is inside that artefact, and if another session owns those edits you are
shipping their unfinished work under your name. A rollback then has no
known-good target.

Build from a commit:

```
git worktree add --detach /d/wt-build <sha>
cp frontend/.env.production /d/wt-build/frontend/
```

Then verify what you built before it goes anywhere — the jar's migration list
and the bundle's API base are both worth reading. If another session has commits
on the same branch, check whether your artefact carries them and whether you
meant it to.

### 4. Say what you are taking, and what you left.

Before: claim a sub-part in `STATE.md` under **In flight** — one line naming the
area and the branch. Read the other entries first; if yours overlaps, message
that session rather than starting.

During: if a change of yours is going out in somebody else's release, or theirs
in yours, one of you says so first. Two changes in one jar means a rollback
cannot tell them apart, and their rollbacks may differ.

After: record what went live — the commit, the asset hash or jar md5, the
rollback command, and the time. A deploy nobody wrote down is a deploy the next
session will overwrite.

## Splitting work so it does not overlap

Split by **user-facing area**, not by layer. One session taking "the backend"
and another "the frontend" of the same feature collide constantly and neither
can prove anything end to end. One taking the Inbox and another the agent wizard
almost never touch the same file, and each can drive its own journey.

A good split has, for each session: its own branch, its own worktree, its own
job file in `docs/jobs/`, and a journey it can run to prove its own work without
the other's change being present.

Before starting, check what is already moving:

```
node scripts/orient.js              # branches, their counts, what is broken
node scripts/parallel.js status     # worktrees and the production lock
```

## Measurement windows

Some work is a measurement, not a change — counting webhooks against nginx, or
watching latency. A backend restart in the middle invalidates it.

If you are measuring, say so and say when the window closes. If somebody else
is, do not restart the service until they say it is closed, even though the lock
would let you.

## What is enforced, and what is not

| | |
|---|---|
| One session deploys at a time | **Enforced** — `deploy-guard.js` blocks the second |
| No deploy from a dirty tree | **Enforced** — blocked on artefact upload |
| One worktree per session | Not enforced. Nothing can tell whose edit is whose |
| Claiming an area in `STATE.md` | Not enforced |
| Recording what went live | Not enforced. `ledger-check.js` warns when the ledger drifts |

The unenforced half is where both of today's collisions began. Treat the written
half as seriously as the blocked half.
