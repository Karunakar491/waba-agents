AGENT-WORKFLOW.md
Model Assignments
Role	Model	Spawned for	Rationale
Worker	claude-sonnet-5	Code, SQL migrations, config files, tests	Fast, cheap, near-Opus quality for coding. The default workhorse.
EL (Engineering Lead)	claude-fable-5	Reviewing every Worker artifact	Deep reasoning, catches subtle bugs, validates architecture. The strongest reviewer.
EM (Engineering Manager)	claude-opus-5	Architecture decisions, tech stack, delivery risk, infrastructure	Strong reasoning at half Fable's cost. Adjustable effort for depth vs speed.
PM (Product Manager)	claude-opus-5	Feature decisions, scope, user story validation, roadmap	Same as EM — strong reasoning, cost-efficient for non-coding decisions.
UX (UI/UX Designer)	claude-opus-5	Frontend component review, brand compliance, interaction quality	Visual reasoning and taste at Opus depth without Fable's price tag.
Design Evaluator	claude-fable-5	World-class outside-eye critique after UX APPROVE	Taste evaluation needs the strongest model available. No compromises.
QA (Quality Assurance)	claude-sonnet-5	Test validation, type-checking, linting, visual regression	Fast, reliable, cheap. Automated where possible, agent-assisted where not.
DevOps	claude-sonnet-5	Infra, deploy, migration, security tasks — deploy safety, rollback plan, operational risk	Fast, reliable, cheap. Checklist-driven verification (kill switch, backup, canary), not open-ended reasoning depth.
> **Cost discipline:** Fable 5 is 2× Opus 5 and 4× Sonnet 5. Reserve it for EL and Design Evaluator only. Opus 5 is the default for all reasoning roles. Sonnet 5 is the default for all execution roles.
---
Maker-Checker Flow (Code)
```
Orchestrator → reads knowledge-index.json
           → spawns Worker (task + context)
Worker     → produces WORKER DRAFT artifact
Orchestrator → spawns EL (artifact only — no Worker reasoning)
EL         → returns APPROVE or REJECT
if REJECT  → Worker revises → EL re-reviews (repeat until APPROVE)
if APPROVE → artifact committed → knowledge-index.json updated
```
Independence rule: EL receives the artifact cold. No Worker explanation. No reasoning. Code defends itself or it fails.
---
Frontend Maker-Checker Flow
Frontend work adds gates before EL:
```
PM APPROVED + EM APPROVED
Worker → produces component
UX → reviews for brand, UX, accessibility (artifact only)
Design Evaluator → reviews for world-class taste (artifact + DESIGN.md only)
EL → reviews for code quality (artifact only)
All must APPROVE before commit.
```
The sequence is: UX → Design Evaluator → EL. EL is always the final gate before commit.
Design Evaluator gate (post-UX)
```
UX APPROVE → Design Evaluator (cold: artifact + DESIGN.md only)
  → PASS (advisory notes logged as follow-ups) → EL
  → BLOCK (only on "generic/AI-generated feel", with evidence) → Worker revises → UX + Evaluator re-review
```
Benchmarks against Linear/Stripe/Vercel bar, not our own checklist.
Never batched with UX or EL. Disagreement with UX → EM decides.
Runs on claude-fable-5 — taste evaluation needs the strongest model.
---
Product / Architecture Questions (Not Code)
```
Product question      → spawn PM → PM answers → surface to user
Architecture question → spawn EM → EM answers → surface to user
```
Detect domain at Orchestrator level. Do not route to both unless explicitly cross-domain.
---
Gate Batching
PM and EM gates for the same task may be batched into a single agent call when:
Both are reviewing the same task brief (not different artifacts)
Neither answer depends on the other
Independence is preserved: the agent plays each role in sequence, not simultaneously. Each role answers without seeing the other's reasoning.
Do NOT batch:
EL — EL always receives the artifact cold and alone.
Design Evaluator — never batched with UX or EL.
QA — runs after all human/agent gates, not batched with them.
---
Fast Track (Small Changes)
Not every change needs full gates. Use Fast Track for low-risk, low-scope changes:
```
Fast Track eligible if ALL of:
  - < 30 lines changed
  - Touches ≤ 2 files
  - Not a design token change
  - Not a new screen
  - Not a security-critical path
  - Not a database migration

Fast Track flow:
  Worker → produces code
  EL reviews (single pass, no UX/PM/EM gates)
  QA automated checks (type-check, lint, tests)
  Commit
```
Fast Track preserves independence (EL still gets artifact cold) but skips non-code gates. This is a velocity valve, not a loophole. If in doubt, use full gates.
---
QA Gate (Automated + Agent-Assisted)
Every artifact — Fast Track or full flow — must pass QA before commit:
```
[Automated] → type-check → lint → unit tests → integration tests
[Agent QA]  → test coverage review → edge case analysis → visual regression (frontend)
```
Automated checks: Run in CI. Fail = block commit, no exceptions.
Agent QA (claude-sonnet-5): Reviews test quality, identifies missing edge cases, flags visual regressions against DESIGN.md. Advisory only — does not block, but logs findings as follow-up tasks.
Frontend visual regression: Screenshot the component, compare against DESIGN.md tokens. Flag mismatches for human review.
QA never blocks on agent findings alone. But if automated checks fail, the commit is dead.
---
Context Window Management
With multiple agents iterating, context grows fast. Manage it deliberately:
Plan-First Rule
```
If a task spans > 3 files or > 400 lines:
  Worker produces PLAN artifact first (architecture, file list, approach)
  EM reviews the plan
  Only then does Worker write code
```
This prevents 3-reject death spirals on large tasks. The plan is cheaper to iterate than the implementation.
Context Summarization
Between EL rejections, summarize context rather than replaying full history:
```
Iteration 1: EL REJECT — missing error state in FormComponent
Iteration 2: EL REJECT — use StatusIndicator instead of custom badge
Iteration 3: EL REJECT — focus trap missing in Modal

→ Summarized context for Worker (iteration 4):
  "Fix three issues in FormComponent: (1) add error state, 
   (2) replace custom badge with StatusIndicator, 
   (3) add focus trap to Modal. See full artifact in attachment."
```
This keeps the Worker context under 8K tokens even after 5+ iterations.
Knowledge Index Schema
The knowledge index is not a flat file list. It is a semantic index:
```json
{
  "components": ["Button", "Modal", "StatusIndicator", "ConsequenceLine"],
  "patterns": {
    "empty-state": "live-preview-or-next-action",
    "error-state": "inline-retry",
    "loading-state": "skeleton-matching-layout"
  },
  "api-contracts": {
    "user": "/api/v1/user",
    "template": "/api/v1/templates"
  },
  "design-tokens": {
    "primary": "brand-pink",
    "frame": "brand-navy",
    "success": "brand-green"
  },
  "recent-decisions": [
    "2026-08-06: radius changed to 12/16px",
    "2026-08-06: shadow system replaced with named tiers"
  ],
  "file-ownership": {
    "frontend/src/components/": "shared primitives",
    "frontend/src/pages/": "page-specific",
    "frontend/src/lib/": "utilities"
  }
}
```
Query this index before spawning any Worker. Update it after every approved commit.
---
EL Rejection Format (exact)
```
REJECT
Reason: [one line]
Fix: [one line]
File: [path:line]
```
---
EL Approval Format
```
APPROVE
[optional one-line note]
```
---
3-Reject Checkpoint (Not a Guillotine)
```
Worker REJECT count reaches 3 on the same task
→ Pause. Do not spawn Worker a 4th time automatically.
→ EM reviews: task brief, all 3 REJECT reasons, all 3 Worker drafts
→ EM returns ONE of:
   - CONTINUE: scope is normal, cap resets to 0, Worker resumes
   - NARROW: reduce scope, rewrite brief, restart (cap resets)
   - ABANDON: task is infeasible or under-specified, close it
```
The 3-reject rule is a checkpoint, not a death sentence. Complex frontend work or API integrations often need 4–6 iterations. The EM decides whether to continue, not a hard counter.
---
Escalation Paths
EM/PM Disagreement
```
EM and PM reach conflicting positions on the same decision
→ Orchestrator surfaces both positions verbatim to user
→ User decides
→ Orchestrator records the decision and proceeds
```
No persona overrides the other. No silent resolution. User is the tiebreaker.
PM/EM Clarification Round (not a hard BLOCK)
```
PM or EM returns BLOCKED with a clarification question — not a hard rejection
→ Orchestrator provides missing context
→ PM/EM re-reviews with that context
→ This does NOT count as a REJECT (no code was written yet)
→ Re-review replaces the original gate, not adds to it
```
A clarification round is not a failure — it means the brief was under-specified.
Worker Crash / Timeout
```
Worker crash or timeout
→ Orchestrator re-spawns Worker once with identical context
→ If second attempt fails → escalate to EM

Worker returns malformed artifact (missing header, unparseable)
→ Orchestrator rejects without spawning EL
→ Counts as one REJECT
→ Worker re-spawned with: original task + malformed artifact + format spec
```
EL Crash / Timeout
```
EL crash or timeout
→ Orchestrator re-spawns EL once with identical artifact
→ If second attempt fails → block commit → escalate to EM
→ No artifact is committed without a valid EL APPROVE
```
---
Rollback Mechanism
```
Every commit is tagged with: task ID, Worker iteration, EL approval timestamp

If a post-commit issue is found:
→ Orchestrator spawns EM + PM to assess severity
→ HOTFIX: Worker patches, fast-track EL (single review), QA automated
→ REVERT: EM approves revert (no Worker needed), QA validates
→ POST-MORTEM: Log root cause in knowledge-index "recent-decisions"
```
No silent fixes. Every rollback or hotfix is recorded.
---
Parallel Work Streams
```
Multiple Workers may run in parallel on independent tasks.
Tasks are independent if they touch no overlapping files.
Orchestrator checks file overlap via knowledge-index "file-ownership" before spawning.

If overlap detected:
→ Queue the second task behind the first
→ Or spawn with a warning: "Task B touches files also modified by Task A. 
   Merge conflicts likely. Proceed?"
```
---
Tool Use Rules
Modern Claude models (Sonnet 5, Opus 5, Fable 5) support tool use. Be explicit about boundaries:
Workers MAY use tools for:
Reading existing files (context gathering)
Running tests (validation)
Checking types (pre-submission)
Searching codebase (find references)
Workers MUST NOT use tools for:
Direct commits (only Orchestrator commits)
Production deployments
Database mutations
External API calls beyond local dev environment
EL MUST NOT use tools. EL reviews the artifact cold. No execution, no test-running, no file-reading beyond the artifact itself.
---
Hard Rules
Rule	No exceptions
No self-approval	Ever
No commit without EL APPROVE	Ever
No commit without QA automated checks passing	Ever
No architecture decision without EM	Ever
No feature decision without PM	Ever
No frontend component without UX APPROVE	Ever
No new screen/design-token change without Design Evaluator	Ever
Knowledge index queried before any file opened	Every task
Knowledge index updated after every approved commit	Every commit
EM/PM conflict → user decides	Every conflict
3rd REJECT → EM checkpoint (continue/narrow/abandon)	Every task
No commit on EL failure	Ever
EL never batched with other roles	Ever
Design Evaluator never batched with UX or EL	Ever
Fast Track never used for design tokens, new screens, or security paths	Ever
---
Artifact Labeling
Worker output must begin with:
```
WORKER DRAFT
File: [path]
Scope: [fast-track | full-gate]
---
[artifact content]
```
EL output must begin with APPROVE or REJECT. No preamble.
QA output must begin with:
```
QA PASS
[optional findings]
```
or
```
QA FAIL
Reason: [one line]
Fix: [one line]
```
---
Changelog
Date	Change
2026-08-07	Updated model assignments to current Claude lineup (Sonnet 5, Opus 5, Fable 5). Added Fast Track for small changes. Added QA gate (automated + agent-assisted). Added context window management (Plan-First rule, context summarization, knowledge index schema). Changed 3-reject cap from hard stop to EM checkpoint. Added rollback mechanism. Added parallel work streams. Added tool use rules. Added scope field to artifact labeling.
