# Agent harness rework — design

**Date:** 2026-09-21
**Status:** approved by founder, implementing
**Supersedes:** the persona-gate system in `CLAUDE.md` and all of `AGENT-WORKFLOW.md`

---

## The problem

Founder: *"The system is not smart. It is acting dumb. It is thinking in silos."*

Three symptoms, one cause.

1. **It can't see the whole product.** Cold review is enforced blindness — "EL receives the artifact cold, no Worker explanation." A reviewer who cannot see the task or the app can only check syntax. That is how a component passes UX review while the app has no sidebar collapse.
2. **It has no judgment about what's worth doing.** A job gets opened to reorder Inbox rows while no human can reply in the Inbox at all. Locally correct, globally stupid.
3. **It does not compound.** Every subagent spawns fresh, returns a paragraph, dies. Memory is split across `MEMORY.md`, `wiki/`, `docs/jobs/`, `TASKS.md` and `docs/knowledge-index.json` — five stores, nothing reads them together, all loaded by hand if remembered at all.

These are not three problems. **Nothing holds a model of reality.** Every action starts from zero and ends in a vacuum. Without a centre there is nothing to see the product in, nothing to judge value against, and nowhere to write back to. The personas, the cold review, the knowledge index and the vault are all scaffolding around a missing centre.

A second, compounding failure: **`CLAUDE.md` describes machinery that was never built.** It documents nine persona gates. The 2026-09-03 overhaul replaced those with three real ones (job in, proof out) plus the machine-enforced `scripts/commit-gate.js`. `wiki/lessons/process.md` states it plainly: *"the gate machinery described in CLAUDE.md was largely never built."* The bible currently describes a fiction, and 349 lines of it are burned into context every single session.

## The fix

Build the centre. Make the machine enforce that everything reads it and writes back to it. Delete the scaffolding that stood in for it.

Three principles, in the vocabulary the founder asked for:

- **Context engineering** — a thin always-on core, everything else pulled on demand. `CLAUDE.md` goes from 349 lines to ~70: invariants only.
- **Harness engineering** — rules the machine enforces via hooks and scripts, not rules a model is asked to remember. One hook exists today; it becomes three plus two scripts.
- **Loop engineering** — close the observe → orient → act → verify → write-back cycle, with evidence at the verify step, instead of persona sign-offs that produce text rather than proof.

---

## Component 1 — `STATE.md` (the ledger)

A single git-tracked file at repo root. The product's true state. Diffable, reviewable in a PR, no new infrastructure, consistent with a repo that is already entirely file-based.

Four sections:

| Section | Holds | Answers |
|---|---|---|
| **Live** | What is deployed, the commit SHA, when, on what host | "Does master match production?" |
| **Broken** | Known defects **ranked by user impact**, each with an evidence link | "Is what I'm about to do the most valuable thing?" |
| **In flight** | Active branches, unmerged work, open jobs | "Am I about to duplicate or clobber something?" |
| **Constraints** | Invariants that bound any task | "What must not happen here?" |

**It is a ranked index, not an archive.** Each entry is one or two lines plus a link into the real detail — `TASKS.md`, `wiki/`, `docs/jobs/`. `TASKS.md` survives unchanged as the long-form backlog; `STATE.md` points at it. Duplicating prose across both is how it goes stale.

Entries are ordered by user impact, not by recency or by area. "No human can reply in the Inbox" ranks above "Inbox row ordering."

**Failure mode and mitigation.** The obvious risk is that `STATE.md` becomes another stale doc. Two defences: the `Stop` hook blocks a session that changed shipped code without touching it (Component 3), and `scripts/orient.js` measures the parts that *can* be measured, so drift in those is caught rather than trusted (Component 4).

## Component 2 — the loop

Every task runs four beats. This replaces the nine-gate sequence.

```
ORIENT  → read STATE.md, run scripts/orient.js.
          Answer three questions before touching anything:
            1. Is this the most valuable thing open?
            2. What does it touch?
            3. What could it break?
          If something in Broken outranks this task, say so before starting.

ACT     → the existing job + proof discipline. It works and it is enforced.
          docs/jobs/<slug>.md, .jobs/current, filled Who/Deciding/Sees, filled Proof.

VERIFY  → evidence, not claims. Re-run the probe. Paste the output.
          "It works" without command output is not a verification.

WRITE   → STATE.md delta. What moved from Broken to Live, what's newly Broken,
BACK      what's now In flight. Enforced by the Stop hook.
```

ORIENT absorbs what the PM and EM gates were reaching for. It is a question asked against real state, not a persona asked to render an opinion.

## Component 3 — the harness

Rules the machine enforces. A rule the model has to remember is not a rule.

| Hook | Script | Enforces |
|---|---|---|
| `SessionStart` | `scripts/session-context.js` | Injects `STATE.md` + top-ranked Broken entries. No more loading memory by hand. |
| `PreToolUse` (Bash/PowerShell) | `scripts/commit-gate.js` *(exists)* | Job, proof, 400-line cap, banned patterns. Unchanged. |
| `Stop` | `scripts/ledger-check.js` | Warns when a session changed shipped code without touching `STATE.md`. |

`ledger-check.js` **warns, it does not block.** A `Stop` hook that hard-blocks can trap a session with no way out, and the failure it guards against (a forgotten ledger write) is recoverable, unlike a bad commit. The commit gate stays the hard block because a commit is the irreversible step.

Scope: "changed shipped code" means tracked files under `frontend/src/`, `backend/src/main/`, or `scripts/`. Editing docs, specs or the wiki does not trigger it.

## Component 4 — `scripts/orient.js`

One command that prints current reality, so ORIENT is cheap enough to always run.

Reports, each independently failing soft:

- **Deploy drift** — local `master` SHA vs. the SHA recorded in `STATE.md` Live. Directly targets the 2026-09-18 incident where production ran code on no branch master could reach.
- **Unmerged branches** — every local branch ahead of `master`, with its commit count. Today that is six, including `feature/draft-on-delete` at ten commits.
- **Open job** — `.jobs/current`, and whether its Proof section is filled.
- **Top Broken** — the first three entries of `STATE.md` Broken.

It is read-only and offline. No SSH, no production calls, no network. Anything requiring a live host stays a deliberate, separate action — that boundary is what keeps production data safe by construction.

## Component 5 — collapsing the personas

Seven agent files become two. Cold review is the silo, so cold review dies.

| Was | Becomes |
|---|---|
| `persona-el.md`, `persona-ux.md`, `QA.md`, `devops-skill.md` | **`reviewer.md`** — one reviewer with full context (the job, `STATE.md`, the diff, the app), selecting its lens from what changed. Frontend files engage the design and token lens; `scripts/`, migrations and deploy paths engage the safety and kill-switch lens. |
| `persona-design-evaluator.md` | **`design-evaluator.md`** — survives. Outside taste is genuinely a different function from code review. Gets app context and `DESIGN.md`, not a blind artifact. |
| `persona-pm.md`, `persona-em.md` | Deleted. Product and architecture judgment moves into the ORIENT beat, where it is asked against real state rather than performed as a gate. |

The lenses are not lost — they move from seven separate blind readers into one reader that can see. What the old gates were *trying* to encode is already written down in `wiki/lessons/`, and the reviewer reads it.

## Component 6 — `CLAUDE.md` rewrite

349 lines → ~70. Every line in it is loaded on every turn of every session, so the bar is: **would this change what I do on an arbitrary task?** If not, it moves to a doc that gets pulled on demand.

Kept:
- Production data is sacrosanct (the full prohibition list — it is the highest-tier rule and it has been violated before)
- The kill switch
- The loop (Component 2)
- The Karpathy standard
- Hard prohibitions: no `any`, no raw SQL in Java, no hardcoded secrets, no test code reachable from production entrypoints, no 400+ line diffs
- Pointers to where everything else lives

Removed or moved:
- The nine-gate sequence, gate batching, gate independence, the 3-reject checkpoint, the model-assignment table — describing machinery that does not exist
- The full memory-vault structure diagram and per-trigger logging table → `wiki/process/`
- The changelog → `wiki/sessions/history-timeline.md`, which already holds it

`AGENT-WORKFLOW.md` is deleted. It is entirely gate machinery and model assignments for gates that will not exist.

---

## What changes on disk

| Path | Action |
|---|---|
| `STATE.md` | **new** — the ledger |
| `scripts/orient.js` | **new** — reality probe |
| `scripts/ledger-check.js` | **new** — `Stop` hook |
| `scripts/session-context.js` | **new** — `SessionStart` hook |
| `.claude/settings.json` | add `SessionStart` + `Stop` hooks |
| `CLAUDE.md` | rewrite, 349 → ~70 lines |
| `AGENT-WORKFLOW.md` | delete |
| `.claude/agents/reviewer.md` | **new** (replaces four) |
| `.claude/agents/design-evaluator.md` | **new** (replaces `persona-design-evaluator.md`) |
| `.claude/agents/persona-{pm,em,el,ux,design-evaluator}.md`, `QA.md`, `devops-skill.md` | delete |
| `TASKS.md`, `wiki/`, `docs/jobs/`, `docs/knowledge-index.json` | unchanged — `STATE.md` links into them |
| `scripts/commit-gate.js` | unchanged |

## Sequencing

The change exceeds the 400-line diff cap, so it ships as four commits, each independently sound:

1. `STATE.md` + `scripts/orient.js` — the centre and its probe, inert until wired
2. `scripts/ledger-check.js` + `scripts/session-context.js` + `.claude/settings.json` — the harness
3. `CLAUDE.md` rewrite + `AGENT-WORKFLOW.md` deletion — the context cut
4. Agent collapse — seven files to two

## Verification

- `node scripts/orient.js` runs offline and reports the six unmerged branches and the open job
- `node scripts/ledger-check.js` warns on a code-touching session with no `STATE.md` change, and stays silent on a docs-only one
- `node scripts/session-context.js` emits `STATE.md` on `SessionStart`
- `scripts/commit-gate.js` still blocks a commit with no job — the new hooks must not regress the one that works
- `CLAUDE.md` is under 100 lines and every remaining rule describes something that actually exists

## Risks accepted

- **`STATE.md` goes stale.** Mitigated by the `Stop` hook and by `orient.js` measuring what is measurable. Not eliminated — the Broken ranking is a human judgment and cannot be probed.
- **One reviewer is less thorough than four.** Accepted deliberately. Four blind reviewers produced approvals for work the founder rejected on sight. Context beats redundancy.
- **Losing the persona files loses their accumulated rules.** Checked: the substance is already in `wiki/lessons/`, which the reviewer reads. The persona files are process framing around it.

## Related

- `wiki/lessons/process.md` — what the old gates were trying to encode; still applies
- `wiki/decisions/maker-checker.md` — the system being replaced
- `docs/jobs/harness-commit-gate.md` — the 2026-09-03 overhaul that built the first real gate
