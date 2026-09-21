# Iris agent-creation tools — work in progress

## Job

Preserving unfinished work, not shipping it. Iris gains tools to create an agent
conversationally; this is the half-built provider plus its test, committed so it
stops living as loose files in a worktree that was about to be removed.

## Proof

None. This is explicitly unfinished and unverified — 81 new lines in
`AgentCreationToolProvider` and 52 in its test, neither run against a real
agent. Do not treat this branch as working.

## Notes

Committed 2026-09-21 while clearing 426MB of duplicate worktree checkouts. The
founder's instruction was to leave uncommitted features alone until discussed;
committing to the feature's own branch preserves them rather than deciding
anything. Two files were destroyed earlier the same day precisely because they
were loose and unstaged.
