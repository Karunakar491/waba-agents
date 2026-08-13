---
title: Anthropic-Standard Codebase Cleanup — 2026-08-13
tags: [process, cleanup, em-review, el-review, codebase-hygiene]
date: 2026-08-13
---

# Anthropic-Standard Codebase Cleanup

## The ask
Founder asked to remove unwanted markdown files and unwanted code lines, define what "Anthropic standard" means for this codebase, validate against it, and get EM/EL sign-off before fixing anything — per CLAUDE.md's own Plan-First rule for multi-file changes.

## The standard (not invented — restated from CLAUDE.md's own bible)
Karpathy Rule (if you can't explain every line, it doesn't ship), simple over clever, flat over nested, no abstraction until 3 concrete cases need it, no dead code / debug leftovers / commented-out blocks kept "just in case," and docs are load-bearing or they don't belong — `CLAUDE.md`/`TECH-STACK.md`/`AGENT-WORKFLOW.md`/`DESIGN.md`/`docs/knowledge-index.json` are referenced and current; anything else claiming to be documentation is superseded by the `wiki/` system.

## Actual audit findings (evidence, not assumption)
- **Source code**: 0 `console.log`, 0 `System.out.println`/`printStackTrace`, 1 legitimate `TODO` (`AgentDetailPage.tsx:2086`, disconnect-phone follow-up), no `.bak`/`.disabled`/`.orig` files, no dead commented-out code blocks. This session's own EL-reject discipline held — no large "unwanted code lines" campaign was actually needed, so none was invented.
- **Repo-root markdown**: real clutter, all git-tracked, all superseded by `wiki/`: 7 `AUDIT-IRIS-*.md` files (one-off Aug 7 audit dump), `AUDIT-FIXES.md`, `AUDIT-TASKS.md`, `OVERNIGHT-RUN-SUMMARY-2026-08-07.md`, an empty (0-byte) `TASKS.md`, and an untracked `IRIS-REDESIGN-DIRECTIONS.md`.
- **`boris-SKILL.md`** (138KB, repo root) — no `.claude/skills/` counterpart, origin/purpose unconfirmed. Flagged to founder rather than silently deleted; founder confirmed delete.
- Confirmed via grep that none of the removed files were referenced by any source file, build config, or the load-bearing docs (`CLAUDE.md`/`TECH-STACK.md`/`AGENT-WORKFLOW.md`/`DESIGN.md`) before removal. Two backend comments reference `TASKS.md TASK-050` / `TASKS.md follow-up` — already dead references since the file was empty; deleting it doesn't change their (already broken) state.

## EM review
No schema change, no new external service, no new queue, no new domain boundary, no auth/PII change — none of persona-em's "Architecture Review Required" triggers apply. Pure documentation removal, fully reversible via git history (all removed files were tracked). **APPROVE** — no ADR required.

## EL review
No production code lines touched — a docs-only diff, so the code-quality gate (diff-size, trace-the-happy-path, security scan, etc.) doesn't meaningfully apply. Confirmed no build tooling or source imports reference the removed files. **APPROVE**.

## What shipped
`git rm` on 11 tracked stale root markdown files (10 audit/summary dumps + `boris-SKILL.md`) + `rm` on 1 untracked stale doc. Not yet committed — per CLAUDE.md, commits happen only when explicitly requested.

## Explicitly not done, flagged not silently skipped
- The single legitimate `TODO` was left as-is — it's a real, intentional follow-up marker, not clutter.
- A large amount of **pre-existing, unrelated uncommitted work** was observed sitting in the working tree across many files and migrations (connector library, Iris tool providers, several DB migrations V42–V51, new frontend components, etc.) spanning multiple earlier sessions. Not touched, not committed, purely flagged — out of scope for a cleanup task and not something to act on without being asked.

## Related
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
