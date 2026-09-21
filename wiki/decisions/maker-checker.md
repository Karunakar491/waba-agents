---
title: Maker-Checker Process
tags: [decisions, process, superseded]
status: deprecated
superseded-by: CLAUDE.md, STATE.md, scripts/orient.js
---

# Maker-Checker Process

> **Deprecated 2026-09-21. Do not follow this.** The persona gates below were
> largely never built — `wiki/lessons/process.md` recorded that as far back as
> the 2026-09-03 overhaul, while `CLAUDE.md` went on describing them for another
> eighteen days. They are replaced by a five-beat loop (ORIENT, ACT, VERIFY,
> REPORT, WRITE BACK) with three machine-enforced hooks, and by one reviewer that
> sees the whole task instead of seven that each saw a slice blind.
>
> Kept, not deleted, because what these gates were *trying* to encode is still
> right and is written up in `wiki/lessons/`. The lesson worth carrying is the
> one this document is evidence for: **a process that exists only in a document
> is not a process.**

## Three Gates

### Gate 1 — PM (before any code)
Spawn PM agent cold. Must answer:
- Does this serve a real user need?
- Does it fit the P0 journey (signup → WABA → wizard → deploy)?
- UX/usability concern?

Returns: **APPROVED** or **BLOCKED**

### Gate 2 — EM (before any code)
Spawn EM agent cold. Must answer:
- Right architecture?
- Domain boundary violation?
- Delivery risk?
- TECH-STACK.md dependency?

Returns: **APPROVED** or **BLOCKED**

### Gate 3 — EL (after code, before commit)
Post `WORKER DRAFT — [filename]` with full artifact.
Spawn EL agent cold — artifact only, zero worker context.

Returns: **APPROVE** or **REJECT** (with exact file:line reason)

On REJECT → revise → re-post → EL reviews again. Cap: 3 rejections → escalate to EM.
On APPROVE → update knowledge-index.json → commit.

## Rules
- All three APPROVEs must be **visible in the conversation**
- "Go ahead" = WHAT to build, never bypasses HOW
- Small task = still requires all three gates
- EL runs **immediately** after writing code — not after user challenge
- PM + EM run **in parallel** (one message, two agents)

## Why
Prevents self-approval, hallucination, and scope creep.
Added explicitly to CLAUDE.md on 2026-07-19 after workflow existed in AGENT-WORKFLOW.md but was not enforced during implementation.
