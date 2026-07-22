# AGENT-WORKFLOW.md

## Model Assignments

| Role | Model | Spawned for |
|---|---|---|
| Worker | claude-sonnet-4-6 | Code, SQL migrations, config files, tests |
| EL (Engineering Lead) | claude-fable-5 | Reviewing every Worker artifact |
| EM (Engineering Manager) | claude-fable-5 | Architecture decisions, tech stack, delivery risk, infrastructure |
| PM (Product Manager) | claude-fable-5 | Feature decisions, scope, user story validation, roadmap |
| UX (UI/UX Designer) | claude-fable-5 | Frontend component review, brand compliance, interaction quality |
| Design Evaluator | session model (fable/opus-class) | World-class outside-eye critique after UX APPROVE — needs taste, not just checklist compliance |

> Haiku for gates: fast, cheap, still holds the bar. Opus reserved for genuinely ambiguous architecture decisions where depth matters.

## Maker-Checker Flow (Code)

```
Orchestrator → reads knowledge-index.json
           → spawns Worker (task + context)
Worker     → produces WORKER DRAFT artifact
Orchestrator → spawns EL (artifact only — no Worker reasoning)
EL         → returns APPROVE or REJECT
if REJECT  → Worker revises → EL re-reviews (repeat until APPROVE)
if APPROVE → artifact committed → knowledge-index.json updated
```

**Independence rule:** EL receives the artifact cold. No Worker explanation. No reasoning. Code defends itself or it fails.

## Frontend Maker-Checker Flow

Frontend work adds one gate before EL:

```
PM APPROVED + EM APPROVED
Worker → produces component
UX → reviews for brand, UX, accessibility (artifact only)
EL → reviews for code quality (artifact only)
Both must APPROVE before commit.
```

The UX gate always runs before EL. For new screens, DESIGN.md changes, or brand-token changes, the sequence is UX → Design Evaluator → EL. EL is always the final gate before commit.

### Design Evaluator gate (post-UX)

For new screens, DESIGN.md changes, or brand-token changes, a Design Evaluator runs AFTER UX APPROVE (see `.claude/skills/persona-design-evaluator.md`):

```
UX APPROVE → Design Evaluator (cold: artifact + DESIGN.md only)
  → PASS (advisory notes logged as follow-ups) → EL
  → BLOCK (only on "generic/AI-generated feel", with evidence) → Worker revises → UX + Evaluator re-review
```

- Exists because the team has no human designer. Benchmarks against Linear/Stripe/Vercel bar, not our own checklist.
- Never batched with UX or EL. Disagreement with UX → EM decides.
- Runs on the session model (not haiku) — taste evaluation needs the strongest model available.

## Product / Architecture Questions (Not Code)

```
Product question      → spawn PM → PM answers → surface to user
Architecture question → spawn EM → EM answers → surface to user
```

Detect domain at Orchestrator level. Do not route to both unless explicitly cross-domain.

## Gate Batching

PM and EM gates for the same task may be batched into a single agent call when:
- Both are reviewing the same task brief (not different artifacts)
- Neither answer depends on the other

Independence is preserved: the agent plays each role in sequence, not simultaneously. Each role answers without seeing the other's reasoning.

Do NOT batch EL — EL always receives the artifact cold and alone. Batching EL with any other role compromises independence.

## EL Rejection Format (exact)

```
REJECT
Reason: [one line]
Fix: [one line]
File: [path:line]
```

## EL Approval Format

```
APPROVE
[optional one-line note]
```

## Escalation Paths

### EM/PM Disagreement
```
EM and PM reach conflicting positions on the same decision
→ Orchestrator surfaces both positions verbatim to user
→ User decides
→ Orchestrator records the decision and proceeds
```
No persona overrides the other. No silent resolution. User is the tiebreaker.

### PM/EM Clarification Round (not a hard BLOCK)
```
PM or EM returns BLOCKED with a clarification question — not a hard architectural rejection
→ Orchestrator provides the missing context (architecture decision, product constraint)
→ PM/EM re-reviews with that context
→ This does NOT count as a REJECT (no code was written yet)
→ Re-review replaces the original gate, not adds to it
```
A clarification round is not a failure — it means the task brief was under-specified. Fix the brief, not the code.

### Consecutive REJECT Cap
```
Worker REJECT count reaches 3 on the same task
→ Do not spawn Worker a 4th time
→ Escalate to EM with: task brief, all 3 REJECT reasons, all 3 Worker drafts
→ EM reassesses: scope too broad / task under-specified / Worker capability gap
→ EM returns: revised task brief OR decision to abandon task
→ Orchestrator restarts from revised brief (REJECT counter resets) OR closes task
```

### Orchestrator Failure Handling
```
Worker crash or timeout
→ Orchestrator re-spawns Worker once with identical context
→ If second attempt fails → escalate to EM

Worker returns malformed artifact (missing header, unparseable)
→ Orchestrator rejects without spawning EL
→ Counts as one REJECT
→ Worker re-spawns with: original task + malformed artifact + format spec

EL crash or timeout
→ Orchestrator re-spawns EL once with identical artifact
→ If second attempt fails → block commit → escalate to EM
→ No artifact is committed without a valid EL APPROVE
```

## Hard Rules

| Rule | No exceptions |
|---|---|
| No self-approval | Ever |
| No commit without EL APPROVE | Ever |
| No architecture decision without EM | Ever |
| No feature decision without PM | Ever |
| No frontend component without UX APPROVE | Ever |
| Knowledge index queried before any file opened | Every task |
| Knowledge index updated after every approved commit | Every commit |
| EM/PM conflict → user decides | Every conflict |
| 3rd consecutive REJECT → EM reassessment | Every task |
| No commit on EL failure | Ever |
| EL never batched with other roles | Ever |

## Artifact Labeling

Worker output must begin with:

```
WORKER DRAFT
File: [path]
---
[artifact content]
```

EL output must begin with APPROVE or REJECT. No preamble.
