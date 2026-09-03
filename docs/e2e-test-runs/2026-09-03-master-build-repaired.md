# Master builds from a clean checkout again — 2026-09-03

Closes the finding recorded in `a129985` / TASKS.md #18: master HEAD had not
built from a clean checkout since `e5ba0ba` (2026-08-25).

## The break, verified independently

Not taken on trust from the commit note:

```
$ git grep -n UnpublishConfirmModal master -- frontend/src
master:frontend/src/pages/AgentDetailPage.tsx:44:import UnpublishConfirmModal from '../components/agent-detail/UnpublishConfirmModal'
master:frontend/src/pages/AgentDetailPage.tsx:720:        <UnpublishConfirmModal

$ git ls-tree master -r --name-only | grep -iE "unpublish|DraftsDisclosure"
NOT TRACKED ON MASTER - confirmed
```

Same for `DraftsDisclosure` (line 45) and `useUnpublishFlow` (line 46). The
`iris/phase-1-agent-creation-tools` worktree was also missing all three, so the
break was inherited by every branch cut from master.

## The fix

Four commits, split at the 400-line cap the commit gate enforces, backend
before frontend so no intermediate commit ships a button without an endpoint:

| Commit | Contents | Lines |
|---|---|---|
| `4d41ad3` | V54 migration + entities + repositories | 83 |
| `228d59b` | service + controller + Meta deletion sweep job | 351 |
| `b6652f9` | unpublish/republish/sweep tests | 288 |
| `6c9928c` | the three missing frontend files + Skills/UI Skills panels | 282 |

## Verification

The working tree held 68 uncommitted files, so a build there would prove
nothing. All of it was stashed to leave exactly master, then restored:

```
$ git status --porcelain | wc -l
68
$ git stash push -u -m "verify-clean-master-2026-09-03"
$ git status --porcelain | wc -l
0
$ git log --oneline -1
6c9928c Add the Unpublish UI that master has been importing since 2026-08-25

$ cd frontend && npx tsc --noEmit
CLEAN_MASTER_TSC_EXIT:0

$ cd backend && mvn -q -o compile -DskipTests
CLEAN_MASTER_MVN_EXIT:0

$ git stash pop
$ git status --porcelain | wc -l
68
```

Both halves compile with nothing uncommitted present. Restoration confirmed by
the file count returning to 68.

## Gate finding

The commit gate blocked commit 4 on a **false positive**: it flagged
`key={item.id}` in `DraftsDisclosure.tsx` as a raw id rendered to a user. A
React key is plumbing, not display. The rule was corrected to require that the
brace not be preceded by `=` (JSX attribute) or `$` (template-literal
interpolation), then unit-tested against seven cases including the real
`AgentsPage.tsx:492` line it must still catch. Fixed rather than bypassed.

## Still not proven

This is a build-level verification only. Nothing here shows the Unpublish
action working against a live agent — that capability still does not exist. The
migration V54 has not been run anywhere.
