---
title: Concurrent Background-Agent Collision — 2026-08-13
tags: [process, multi-agent, orchestration, post-mortem]
date: 2026-08-13
---

# Concurrent Background-Agent Collision

## What Happened
Two background agents were dispatched to overlapping parts of the same 8-series Figma build (Agents home screen, library pages, 7-step wizard) within the same working tree, at nearly the same time. One agent read `AgentsPage.tsx`, held it in context, and began writing; the other agent, working faster, had already grown the same file from 489 to 644 lines by the time the first agent tried to write its own version. The write was rejected with "file has been modified since read."

## Detection
The slower agent noticed its own held content no longer matched disk, cross-checked new untracked files that had appeared mid-session (`LibraryItemCard.tsx`, `LibraryToolbar.tsx`, a new Flyway migration, modified `Skill.java`/`SkillDtos.java`/`SkillLibraryService.java`) against timestamps, and correctly inferred a second writer was active on the identical task.

## What It Did (correct response)
Stopped immediately rather than racing the other writer or force-overwriting. It had already created one new file (`shared/Toggle.tsx`) before noticing the collision — once it saw the other agent had built its own inline toggle for the same purpose, it **deleted its own file** rather than leave an orphan duplicate primitive behind (exactly the kind of dead-code residue CLAUDE.md's dead-code discipline forbids). It then compiled a gap list (Figma node ids, exact content diffs already derived) and handed it off in its final report for whichever agent's work actually landed to be checked against, instead of quietly reporting partial/inflated progress.

## Root Cause
Two independent dispatches given effectively the same scope (the founder's original ask — "build 7 8 9" — was broad enough that two different orchestration attempts both decomposed it down to "rebuild the Agents module") were run in parallel without any coordination lock between them.

## Rule to Remember
> Two agents writing to the same files with no coordination produce silent lost updates — one agent's work simply vanishes with no error, unless the losing writer happens to detect the mismatch itself (as here). When dispatching multiple background agents at once, scope them to disjoint file sets, or dispatch sequentially when the scope can't be cleanly split. An agent that detects mid-flight that another writer beat it to the same files should stop and report the collision, not force an overwrite — and should clean up any of its own orphan files rather than leave dead code behind as the price of stopping safely.

## Related
- [[../decisions/reusable-library-over-meta-execution-2026-08-13|Reusable library over Meta execution]]
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
