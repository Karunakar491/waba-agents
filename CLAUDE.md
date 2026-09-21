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
