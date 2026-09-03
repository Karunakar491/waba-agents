# Commit gate (job + proof + diff enforcement)

## Job

Karunakar opens the repo history deciding whether the process is being followed;
he sees that no commit can exist without a named job and a proof artifact, because
the gate refuses the commit rather than reporting compliance in prose.

## Proof

`docs/e2e-test-runs/2026-09-03-commit-gate.md` — eight pipe-tests against the real
hook script, each showing the actual deny/allow decision:

- T1 no `.jobs/current` → DENY
- T2 `git status` → allowed (gate only fires on commits)
- T3 `git commit --dry-run` → allowed
- T4 unfilled template → DENY (no Job section)
- T5 Job filled, Proof placeholder → DENY (no Proof section)
- T6 both filled → allowed
- T7 staged `.tsx` with `#ff00aa` and `{agent.id}` → DENY, both patterns named
- T8 staged 502-line diff → DENY at the 400 cap

Hook liveness confirmed by sentinel: `/tmp/claude-gate-check.txt` recorded two
firings on unrelated Bash calls, proving the hook is wired and executing rather
than merely present in `settings.json`.

## Notes

Built first, before the test environment and before any UI audit, because it is
the part of the harness that constrains Claude. Order matters: enforcement before
the work it enforces.

Escape hatch is deliberately visible — a slug starting with `chore/` skips the
Proof check and records that exemption in the slug itself. There is no silent
bypass and no env-var override.

The banned-pattern list starts with three rules, one of which encodes the actual
defect that started this overhaul: a raw internal id rendered in a user-facing
JSX cell ([AgentsPage.tsx:492](../../frontend/src/pages/AgentsPage.tsx#L492)).
Each future defect we find should become a rule here rather than a memory file,
so the lesson cannot decay.

Known gap: the gate cannot judge whether the Proof section is *honest* — it only
checks that it is non-empty. That residual is tier 3 (human) by design.
