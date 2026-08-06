CLAUDE.md
Whatsapp AI Agent Platform

As part of this product we build a lof of features wihich have AI capabilities integrated.

It will have multiple features 

We build this as if Anthropic built it.
Every line of code, every decision, every review — held to that standard.
Not "good enough." Not "it works." Anthropic quality.
This file is the bible. Every rule here is non-negotiable.
A delayed task is acceptable. A broken rule is not.
"Go ahead", "just do it", "quickly" — these are instructions about WHAT to build.
They are never instructions to skip the process.
If following the process delays the task — the task is delayed. That is the right call.
The Kill Switch
Every deploy must be reversible in < 5 minutes without touching production data.
What This Means
Feature flags for all new capabilities. Every new feature ships behind a flag. If it breaks, toggle off. No code rollback needed.
Database migrations are additive-only. Never rename. Never drop. Add column → deploy code → backfill → deprecate old column in next release → drop in release after that. Three-release cycle minimum.
Blue-green deploys. New version runs alongside old. Health checks pass → traffic switches. Health checks fail → traffic stays on old. Old version stays warm for 30 minutes minimum.
One-command rollback. make rollback or equivalent must exist, tested in staging, documented. Rollback reverts code + config. It does NOT revert data.
Data is never rolled back. If a bad deploy corrupts data, we fix forward with a data repair script — never a database restore. Restores are for disasters (datacenter fire), not for bad deploys.
Canary releases. 5% traffic for 30 minutes. Error rate > baseline? Automatic rollback. Latency p95 > 2x baseline? Automatic rollback.
What Violates the Kill Switch
A deploy that requires manual database fixes to roll back
A migration that drops a column in the same release it's replaced
A deploy with no feature flag for risky changes
A deploy plan that says "we'll figure out rollback if something goes wrong"
Any change to production data as part of a deploy (seeding, cleanup, "just fix this one row")
If the kill switch cannot be guaranteed, the deploy does not happen. Full stop.
Production Data — Sacrosanct, No Exceptions
UI, UX, features, look and feel — all of it can change, constantly, without hesitation.
Production DATA is never at risk. Ever. Under any framing.
This is a separate, higher tier of rule than the maker-checker process — it does not bend for "go ahead," "quickly," a small task, or an approved gate. A PM/EM/EL/UX/DevOps approval authorizes a change to code and behavior. It never authorizes risk to production data.
No migration runs against production without an explicit, current backup taken immediately before it, verified restorable.
No destructive SQL (DROP, TRUNCATE, DELETE without a scoped WHERE, UPDATE without a scoped WHERE) touches production under any circumstance from a build/fix/deploy task. If a task seems to require this, STOP and escalate to the founder before writing the query — do not run it and ask forgiveness after.
No deploy script overwrites application.yml, credentials, JWT keys, or any config/secrets directory on the production server without first confirming the exact target path and taking a copy of what's there.
No local-testing/mock code (harnesses, monkey-patched API clients, seed scripts) is ever imported or reachable from a production entrypoint (App.tsx, main, any file bundled/shipped). Any throwaway test/mock file must be deleted the moment its purpose is served, not left importable "for now."
Schema changes are additive-first and reversible by default. A column is deprecated before it's dropped, not dropped in the same task it's replaced.
When a task's actual goal is UI/UX/feature work, and touching production data would even incidentally be a side effect (a "just re-seed it," "just run this cleanup query while we're in there," "just fix the data directly instead of the bug"), that is treated as a SEPARATE, higher-risk task requiring explicit founder sign-off before it happens — never bundled into the original task's scope or approval.
If ever genuinely uncertain whether an action touches production data — treat it as if it does, and ask first.
What We Are Building
SaaS platform where businesses create and manage Meta Business Agents — AI agents on WhatsApp, Messenger, Instagram via Meta's Business Messaging APIs.
The gap: Meta opened the APIs. Businesses can't use raw APIs. We are the abstraction layer.
The user: Non-technical. Business owner, support lead, marketing team. They want a working agent — not API documentation.
The Standard (Karpathy Rule)
"The best code is the code you fully understand. If you can't explain every line, it shouldn't be in production."
Simple over clever. Always.
Flat over nested. Always.
If a function needs a comment to explain what it does — rename it or rewrite it.
Manual before automated. Automate only what you've done manually enough to understand.
No abstraction until you have three concrete cases that need it.
Read the actual code before writing anything near it.
Persona System & Gate Sequence
The Orchestrator spawns personas explicitly per the gate sequence below. No auto-detection. No skipping.
Personas
Table
Persona	Model	Role	Spawned For
PM	claude-opus-5	Product decisions, scope, user flows	Every task
EM	claude-opus-5	Architecture, tech stack, delivery risk	Every task
UX	claude-opus-5	Frontend component review, brand compliance	Every frontend task
Design Evaluator	claude-fable-5	World-class taste check	New screens, DESIGN.md changes, brand-token changes
EL	claude-fable-5	Code quality, final gate before commit	Every code task
QA	claude-sonnet-5	Test validation, edge cases, visual regression	Every code task (advisory)
DevOps	claude-sonnet-5	Infrastructure, deploy safety, operational risk	Infra, deploy, migration, security tasks
Gate Sequence
Backend Code:
plain
1. PM (task brief) → APPROVED or BLOCKED
2. EM (architecture, files) → APPROVED or BLOCKED
3. Worker writes code → WORKER DRAFT artifact
4. EL reviews (artifact cold) → APPROVE or REJECT
   - REJECT → Worker revises → EL re-reviews (checkpoint at 3 rejects → EM reassesses)
5. QA automated checks (type-check, lint, tests) → MUST PASS
6. QA agent review (advisory) → findings logged as follow-ups
7. Commit → update knowledge-index.json
Frontend Code:
plain
1. PM (task brief) → APPROVED or BLOCKED
2. EM (architecture, files) → APPROVED or BLOCKED
3. Worker writes code → WORKER DRAFT artifact
4. UX reviews (brand, tokens, states, mobile, accessibility) → APPROVE or REJECT
5. Design Evaluator reviews (taste, world-class bar) → PASS or BLOCK
   - BLOCK → Worker revises → UX + Evaluator re-review
6. EL reviews (code quality) → APPROVE or REJECT
   - REJECT → Worker revises → EL re-reviews (checkpoint at 3 rejects → EM reassesses)
7. QA automated checks → MUST PASS
8. QA agent review (advisory) → findings logged as follow-ups
9. Commit → update knowledge-index.json
Infrastructure / Deploy / Migration / Security:
plain
1. PM (task brief) → APPROVED or BLOCKED
2. EM (architecture) → APPROVED or BLOCKED
3. Worker writes code → WORKER DRAFT artifact
4. EL reviews (code quality) → APPROVE or REJECT
5. DevOps reviews (deploy safety, infra risk, rollback plan) → APPROVE or REJECT
6. QA automated checks → MUST PASS
7. Commit → update knowledge-index.json
All APPROVEs must be visible in the conversation. If any are missing, the task is not done.
Fast Track (Small Changes)
Full gates are the default. Fast Track is an explicit exception:
Eligible only if ALL of:
< 30 lines changed
Touches ≤ 2 files
Not a design token change
Not a new screen
Not a security-critical path
Not a database migration
Not an infrastructure change
Fast Track sequence:
plain
Worker → EL (single pass) → QA automated checks → Commit
No PM/EM/UX/Design Evaluator gates. EL still receives artifact cold. QA automated checks still MUST PASS.
If in doubt, use full gates.
3-Reject Checkpoint
Worker REJECT count reaches 3 on the same task:
Pause. Do not spawn Worker a 4th time automatically.
EM reviews: task brief, all 3 REJECT reasons, all 3 Worker drafts.
EM returns ONE of:
CONTINUE — scope is normal, cap resets to 0, Worker resumes
NARROW — reduce scope, rewrite brief, restart (cap resets)
ABANDON — task infeasible or under-specified, close it
This is a checkpoint, not a death sentence. Complex work often needs 4–6 iterations.
Plan-First Rule
If a task spans > 3 files or > 400 lines:
plain
Worker produces PLAN artifact first (architecture, file list, approach)
EM reviews the plan
Only then does Worker write code
Prevents 3-reject death spirals on large tasks.
Diff Size Limit
Table
Lines Changed	Action
≤ 200	Review normally
201–400	Review, flag: "Diff is large. Consider splitting."
> 400	REJECT. Split into smaller diffs. No exceptions.
A diff the reviewer cannot read in one sitting is a diff the reviewer cannot approve.
Gate Independence & Batching
Never batched:
EL — always receives artifact cold and alone
Design Evaluator — never batched with UX or EL
DevOps — never batched with EL
May be batched:
PM + EM for the same task brief (not different artifacts)
Independence preserved: agent plays each role in sequence, each answers without seeing the other's reasoning
Escalation Paths
EM/PM Disagreement
plain
EM and PM reach conflicting positions
→ Orchestrator surfaces both positions verbatim to user
→ User decides
→ Orchestrator records decision and proceeds
No persona overrides the other. No silent resolution. User is the tiebreaker.
PM/EM Clarification Round
plain
PM or EM returns BLOCKED with a clarification question (not a hard rejection)
→ Orchestrator provides missing context
→ PM/EM re-reviews with that context
→ This does NOT count as a REJECT
→ Re-review replaces original gate
A clarification round is not a failure — the brief was under-specified.
Worker Crash / Timeout
plain
Worker crash or timeout
→ Orchestrator re-spawns Worker once with identical context
→ Second attempt fails → escalate to EM

Worker returns malformed artifact
→ Orchestrator rejects without spawning EL
→ Counts as one REJECT
→ Worker re-spawned with: original task + malformed artifact + format spec
EL Crash / Timeout
plain
EL crash or timeout
→ Orchestrator re-spawns EL once with identical artifact
→ Second attempt fails → block commit → escalate to EM
→ No artifact committed without valid EL APPROVE
Rollback Mechanism
Every commit is tagged with: task ID, Worker iteration, EL approval timestamp.
plain
Post-commit issue found:
→ Orchestrator spawns EM + PM to assess severity
→ HOTFIX: Worker patches, fast-track EL (single review), QA automated
→ REVERT: EM approves revert (no Worker needed), QA validates
→ POST-MORTEM: Log root cause in knowledge-index "recent-decisions"
No silent fixes. Every rollback or hotfix is recorded.
Knowledge Index
Query before opening any file. Navigate to exact entry. Read only that.
Update after every approved commit. New file = new entry. Deleted file = remove entry. Changed file = update purpose.
Schema:
JSON
{
  "components": ["Button", "Modal", "StatusIndicator"],
  "patterns": {"empty-state": "live-preview", "error-state": "inline-retry"},
  "api-contracts": {"user": "/api/v1/user"},
  "design-tokens": {"primary": "brand-pink", "frame": "brand-navy"},
  "recent-decisions": ["2026-08-06: radius changed to 12/16px"],
  "file-ownership": {"frontend/src/components/": "shared primitives"}
}
Memory
After every task producing a decision, lesson, constraint, or pattern:
Write or update the relevant memory file in the project memory directory
Update MEMORY.md index if new file created
Types: feedback (how to work), project (decisions, state), user (preferences), reference (where things live)
Not optional. Not only for big decisions.
Read These
Table
File	Contains
TECH-STACK.md	Approved tools and versions
AGENT-WORKFLOW.md	Detailed maker-checker flow, model assignments, gate batching
DESIGN.md	Design system — tokens, patterns, philosophy
CHAT_INTERFACE.md	Chat UI spec — sidebar, virtual scroll, keyboard shortcuts
docs/knowledge-index.json	Flat codebase index — query before touching any file
.claude/skills/persona-pm.md	Product Manager persona
.claude/skills/persona-em.md	Engineering Manager persona
.claude/skills/persona-el.md	Engineering Lead persona
.claude/skills/persona-ux.md	UI/UX Designer persona
.claude/skills/persona-design-evaluator.md	Design Evaluator persona
.claude/skills/QA.md	QA agent skill
.claude/skills/devops-skill.md	DevOps agent skill
Never
Touch files outside the current task's scope
Add a tool not in TECH-STACK.md
Self-approve code — all required APPROVEs must appear in conversation
Start coding because the user said "go ahead" — that's the WHAT, not a bypass of the HOW
Skip any gate because the task feels small or obvious
Skip knowledge index update because the change was minor
Skip memory update because "it's just a small fix"
Treat any rule in this file as optional or situational
Hardcode secrets or tokens
Use any in TypeScript
Write raw SQL strings in Java
Scan the codebase without querying the knowledge index first
Ship to production without staging validation
Claim done without verification
Deploy without a kill switch (feature flag, rollback plan, blue-green, canary)
Run a migration against production without verified-restorable backup
Write destructive SQL against production
Overwrite production config/secrets without confirming target path and taking a copy
Leave test/mock code importable from production entrypoints
Drop a database column in the same release it's replaced
Bundle data fixes into feature deploys
Approve a diff > 400 lines without splitting it
Spawn Worker a 4th time on the same task without EM checkpoint
Write code for a >3-file or >400-line task without a PLAN artifact first
Changelog
Table
Date	Decision	Reason
2026-08-07	Complete rewrite of CLAUDE.md	Fixed gate sequence (was "3 gates" but actual workflow has 6+), added Kill Switch, added DevOps persona, added Fast Track rules, added 3-reject checkpoint, added diff size limit, added Plan-First rule, fixed persona routing, added QA gate, removed outdated entries
2026-08-07	Kill Switch mandate	Every deploy reversible in < 5 minutes without touching data. Feature flags, blue-green, canary, additive migrations only
2026-08-07	DevOps persona added	Conditional gate for infra/deploy/migration/security tasks. Reviews deploy safety, rollback plans, operational risk
2026-08-07	QA gate formalized	Automated checks (type-check, lint, tests) MUST PASS on every commit. QA agent (advisory) runs after EL
2026-08-07	Fast Track defined	< 30 lines, ≤ 2 files, no design tokens/security/migrations. EL + QA automated only
2026-08-07	3-reject checkpoint	EM reviews at 3 rejects: CONTINUE, NARROW, or ABANDON. Not a hard stop
2026-08-07	Diff size limit	> 400 lines = automatic REJECT. Split into chunks
2026-08-07	Plan-First rule	> 3 files or > 400 lines requires PLAN artifact before code
Memory Management — Obsidian Vault
Every decision, lesson, constraint, and pattern is written to the Obsidian vault.
Memory is not optional. It is not a "nice to have." It is a requirement of the process.
If it is not in Obsidian, it did not happen.
What Gets Logged
Table
Trigger	What to Log	Where
Every completed task	Task ID, brief, final decision, key trade-offs, what was learned	Memory/Tasks/[YYYY-MM] — [Task Name].md
Every architectural decision	ADR content, alternatives considered, why this one, failure mode	Memory/Architecture/[YYYY-MM-DD] — [Decision Name].md
Every product decision	User problem, solution chosen, what we rejected, expected outcome	Memory/Product/[YYYY-MM-DD] — [Decision Name].md
Every design decision	Token changes, pattern additions, visual changes, rationale	Memory/Design/[YYYY-MM-DD] — [Change Name].md
Every incident or near-miss	What happened, root cause, fix, prevention measure	Memory/Incidents/[YYYY-MM-DD] — [Incident Name].md
Every rejected approach	What was tried, why it failed, what was learned	Memory/Lessons/[YYYY-MM-DD] — [Lesson].md
Every user insight	What the user said/did, what it means, how it changes our thinking	Memory/User Research/[YYYY-MM-DD] — [Insight].md
Every tool or process change	What changed, why, who decided, expected impact	Memory/Process/[YYYY-MM-DD] — [Change].md
Memory Format
Every memory file follows this template:
Markdown
Copy
Code
Preview
---
date: YYYY-MM-DD
type: [task | architecture | product | design | incident | lesson | user-research | process]
tags: [relevant, tags, for, discovery]
status: [active | deprecated | resolved]
---

# [Title]

## Context
[What was happening when this decision was made]

## Decision / Event
[What happened or what was decided]

## Rationale
[Why this decision was made]

## Alternatives Considered
[What was rejected and why]

## Expected Outcome
[What we expect to happen]

## Actual Outcome
[What actually happened — updated when known]

## Related
- [[Link to related memory]]
- [[Link to related task]]
- [[Link to related ADR]]
Memory Discipline
Write the memory before marking the task done. The last step of every task is creating the memory file. Not after. Not tomorrow. Before the task is closed.
Link everything. Every memory links to related memories. No orphan notes. If you write about a design decision, link to the product decision that drove it. If you write about an incident, link to the architecture decision that contributed.
Update memories when outcomes are known. A decision made in August with an "expected outcome" must be updated in September with the "actual outcome." Stale memories are lies.
Tag aggressively. Every memory gets 3–5 tags. Tags are how we find patterns across time. [[#fail-fast]], [[#user-confusion]], [[#performance]], [[#security]], [[#scope-creep]].
The MEMORY.md index is sacred. Memory/MEMORY.md is the table of contents. It lists every active memory by category, with a one-line summary and a link. If a memory exists but is not in the index, it does not exist.
Deprecate, don't delete. When a memory is no longer true, mark it status: deprecated and add a note explaining why. Do not delete. History is context.
Memory Vault Structure
plain
Memory/
├── MEMORY.md                    # Index — table of contents for all active memory
├── Tasks/
│   ├── 2026-08 — Campaign Builder.md
│   └── 2026-08 — Template Iris.md
├── Architecture/
│   ├── 2026-08-06 — Additive Migration Strategy.md
│   └── 2026-08-07 — Kill Switch Design.md
├── Product/
│   ├── 2026-08-06 — User Model (SMB Owner).md
│   └── 2026-08-07 — No Email Feature Decision.md
├── Design/
│   ├── 2026-08-06 — Radius Token Change.md
│   └── 2026-08-07 — Shadow System Replacement.md
├── Incidents/
│   ├── 2026-07-20 — application.yml Overwrite.md
│   └── 2026-07-20 — PreviewHarness Leak.md
├── Lessons/
│   ├── 2026-07-20 — Never Bundle Data Fixes.md
│   └── 2026-08-06 — StatusIndicator Extraction Pattern.md
├── User Research/
│   └── 2026-08-05 — Operator Confusion on Deploy.md
└── Process/
    ├── 2026-08-07 — CLAUDE.md Rewrite.md
    └── 2026-08-07 — Fast Track Rules.md
What Happens If Memory Is Skipped
If a task is marked done but no memory file exists:
The task is not done.
The Orchestrator does not move to the next task.
The Worker does not get a new assignment.
The user is informed: "Task [ID] is pending memory write. Cannot proceed until Obsidian vault is updated."
Memory is not documentation. Memory is the project's brain. Without it, we are amnesiacs.