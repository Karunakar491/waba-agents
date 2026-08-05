---
title: Bugs & Violations
tags: [bugs, violations, index]
---

# Bugs & Violations

## CLAUDE.md Violations (process)
- [[violations-2026-07-20|Session 2026-07-20]] — EL gate skipped, knowledge index late, memory not updated, Karpathy ignored

## Bug Post-Mortems
- [[bug-dark-mode-accent|Dark Mode Accent Bug]] — `--accent` in `.dark` collapsed to muted (EL caught)
- [[bug-application-yml-overwrite|application.yml Overwrite]] — SCP overwrote server config, broke deploy
- [[error-message-conflation-2026-08-04|ProtectedRoute Error-Message Conflation]] — "no modules" and "fetch failed" show the identical lock screen; plus a self-caught TSID serialization bug in Iris session DTOs

## Resolved TASKS (22 total — all done)
See [[../docs/tasks|TASKS]] for full list. Key ones:
- TASK-001: `systemPrompt` missing on Agent entity
- TASK-002: SecurityContext in RabbitMQ thread
- TASK-003: JWT not in httpOnly cookie
- TASK-006: `account_id` missing on 5 child entities
- TASK-021: Claude in message pipeline (deleted)
