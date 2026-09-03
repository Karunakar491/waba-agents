# Commit gate — verification run, 2026-09-03

Every case below was piped into the real `scripts/commit-gate.js` with the same
stdin payload shape Claude Code sends a `PreToolUse` hook. Output is verbatim.

## T1 — no active job

```
$ echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m test"}}' | node scripts/commit-gate.js
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
"permissionDecisionReason":"COMMIT BLOCKED — no active job.\n\nEvery change traces to a
named job. Create one:\n  1. Write docs/jobs/<slug>.md (copy docs/jobs/TEMPLATE.md)\n
2. echo <slug> > .jobs/current\n\nThe job file must answer: who opens this, what are
they deciding, what will they see that changes the decision."}}
```

## T2 / T3 — non-commit commands pass through

```
$ ... {"command":"git status"}          → (no output = allowed)
$ ... {"command":"git commit --dry-run"} → (no output = allowed)
```

## T4 — job file is the unfilled template

```
DENY: COMMIT BLOCKED — docs/jobs/_test.md has no filled-in "## Job" section.
```

## T5 — Job written, Proof still a placeholder comment

```
DENY: COMMIT BLOCKED — docs/jobs/_test.md has no filled-in "## Proof" section.
```

## T6 — both sections filled

```
ALLOWED
```

## T7 — banned patterns in a staged .tsx

Staged: `export const X = () => <div className="bg-[#ff00aa]">{agent.id}</div>`

```
COMMIT BLOCKED — banned patterns in the staged diff:

  frontend/src/_gate_probe.tsx
    hardcoded hex color: export const X = () => <div className="bg-[#ff00aa]">{agent.id}</div>
    → Use a design token from DESIGN.md, not a raw hex value.

  frontend/src/_gate_probe.tsx
    raw internal id rendered in JSX: export const X = () => <div className="bg-[#ff00aa]">{agent.id}</div>
    → A user-facing screen should not display an internal identifier. This is the
      AgentsPage.tsx:492 defect. If an operator genuinely needs the id, put it on a
      debug surface, not in a primary table cell.
```

## T8 — diff over the 400-line cap

```
COMMIT BLOCKED — staged diff is 502 lines, cap is 400.
```

## Hook liveness

The script working in isolation does not prove the hook is wired. A sentinel was
temporarily prefixed to the hook command, then two unrelated `Bash` calls were made:

```
$ cat /tmp/claude-gate-check.txt
gate fired Thu Sep  3 17:54:05 IST 2026
gate fired Thu Sep  3 17:54:16 IST 2026
```

Sentinel removed afterwards. Probe files (`_gate_probe.tsx`, `_gate_big.ts`,
`docs/jobs/_test.md`) were unstaged and deleted.
