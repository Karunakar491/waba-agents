---
title: Maker-Checker Process
tags: [decisions, process, non-negotiable]
---

# Maker-Checker Process

**Non-negotiable. No exceptions. No self-approval.**

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
