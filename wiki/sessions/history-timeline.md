---
title: Project History — Timeline
tags: [history, timeline, index, sessions]
---

# Project History — Timeline

> Every dated piece of project state, decision and incident recorded by the agent between 2026-07 and 2026-09, newest first. Consolidated here on 2026-09-04 from the agent memory index, which had grown past the point of being readable.

> Full original notes are archived at `~/.claude/projects/d--Meta-business-agents/memory/archive-2026-09-04/`. Durable reusable rules were extracted separately into [[lessons/INDEX|Lessons]].


## 2026-09

- **2026-09-07** — Postman-Shaped Connectors · both levels tabbed to match Postman (connector=collection, action=request); collection headers/body NOT copied because Meta's connector object has neither; auth tab reports inheritance since Meta forbids per-tool auth; Variables surfaces Meta's three closed macros
- **2026-09-06** — Connectors Became One Screen · list page deleted, sidebar is the only list; "Publish" repointed at Meta after being the button that flipped a local flag gating nothing while "Deploy" did the publishing; library tables everywhere; logrotate after a third disk-full
- **2026-09-03** — Daily User Challenges Audit · 31 evidence-backed user problems on the real WABA; token refresh unwired (logged out every 15 min), no human can reply, nothing ever closes
- **2026-09-03** — master HEAD Unbuildable · dangling unpublish imports since 08-25; master can't build from a clean checkout, prod maps to no commit
- **2026-09-03** — StepBasics Self-Conflict Fix · own agent's bound number falsely showed as taken after Back/draft-resume
- **2026-09-03** — Iris Phase 0 Verified · doc-vs-Java checks accurate; live Meta verification skipped project-wide, no test WABA exists
- **2026-09-03** — Process Overhaul · 9 gates → 3 (job in, proof out); CLAUDE.md machinery never existed; commit gate live
- **2026-09-03** — Master Deploy Flagged · first traceable deploy since 08-25; Flyway CRC32 recovery; mvn compile without clean gives false passes
- **2026-09-03** — Batch 2 Deploy · 4 features live from an exact commit; backend suite red on master; non-hermetic Testcontainers
- **2026-09-03** — Playwright Harness · browser tests live against prod (first ever); read-only by design

## 2026-08

- **2026-08-26** — karix-mcp Image Fix Deploy · deployed 86559b0 + 68c3dc7 to prod; found broken HEAD build + stray worktree
- **2026-08-26** — RabbitMQ App Stopped · 503 after deploy; rabbit app stopped not corrupted, start_app alone fixed it
- **2026-08-26** — Disk Full Recurrence · app.log filled prod disk again; logrotate still not configured
- **2026-08-25** — Deploy Folder + Incidents Writeup · wiki/deployment/2026-08-25-session/: runbook, disk-full, RabbitMQ vhost corruption
- **2026-08-25** — Connector Tool Params Editor · Add Tool UI gained path/query/header params + body + edit; 3 EM + 3 UX rounds
- **2026-08-25** — IndiaMART Journey v2 Delta · plan invalidated mid-execution by stale baseline; re-scoped delta shipped
- **2026-08-25** — IndiaMART Agent Stuck Typing · agent generates no response; ruled out our config, matches Iris stuck-thinking
- **2026-08-20** — Message-Webhook Link · Inbox message icon jumps to originating webhook_raw row via webhookRawId
- **2026-08-20** — Webhook Campaign Filter · drop external campaign status webhooks via biz_opaque_callback_data, not pricing.category
- **2026-08-20** — Manual Form Validation · TASKS.md #5 6/8 fixed; plan's own layout assumption wrong, caught only by whole-branch review
- **2026-08-20** — CAROUSEL Manual Editor · TASKS.md #12; 2nd silent-data-loss bug found only via whole-branch review
- **2026-08-19** — Iris Excel Template Recommendations · xlsx upload → Iris recommends+creates templates per row; not yet live-tested
- **2026-08-19** — Iris Platform-Default Key Fallback · opt-in shared OpenAI key stopgap; EL caught a missed 3-arg constructor call site
- **2026-08-19** — WabaPicker Redesign Block/Fix · Design Evaluator blocked a still-boxy selector; passed after no-chrome-at-rest pattern
- **2026-08-19** — Template Studio Empty Credential Pick Fix · unordered findFirstByWabaId → silent empty template list; commit 272af7d
- **2026-08-19** — Iris Phase 9 Quality Fixes · 5 template-creation fixes; manual editor gaps filed as TASKS.md #5
- **2026-08-19** — Iris Production Deploy · 8 commits deployed + live-verified; DevOps rejected plan twice; SSH bastion path documented
- **2026-08-18** — Iris Entitlement Bug Fix · Business-Agents-only accounts fixed; separation Phase 0/2 done
- **2026-08-18** — Iris feature_key Migration · Phase 3 additive feature_key tags Template Studio vs Business Agents sessions
- **2026-08-18** — Iris Dual-Path Routing · Phase 4 /api/v1/iris alongside legacy; path literals coupled via IrisPaths.java
- **2026-08-18** — Iris Frontend Cutover Phase 5 · IrisRail.tsx cut to /api/v1/iris
- **2026-08-18** — Iris Frontend Cutover Phase 6 · Template Studio frontend cut over; both consumers migrated
- **2026-08-13** — Session 2026-08-13 Full Writeup Pointer · read wiki/sessions/session-2026-08-13.md for full detail
- **2026-08-13** — Agent Delete = Real Meta Teardown · delete now does best-effort Meta teardown; UI names what's left behind
- **2026-08-13** — Reusable Library over Meta Execution — Connectors · 3-layer pattern extended to Connectors; secrets never stored
- **2026-08-13** — Connector Local Mirror V45 · upsert-on-read sync, cached fallback when Meta down
- **2026-08-13** — Agents 8-Series Full Build · Agents home rebuilt, 3 libraries as card grids, 7-step wizard
- **2026-08-13** — Agents Module Figma 8-Series Audit · About column + Empty state matched to Figma; wizard gaps deferred
- **2026-08-13** — Concurrent Agent Collision · two agents wrote the same files; second aborted rather than clobber
- **2026-08-12** — Flyway V37/V38 Missing on Server · server migration dir drifted behind source, crash-loop
- **2026-08-12** — Iris Logging Audit + Demo WABA Cleanup · Iris confirmed in prose instead of calling the tool
- **2026-08-12** — Template Studio Create/Edit Richer Fields · LTO/LOCATION/COPY_CODE/named-params + mandatory Stepper
- **2026-08-12** — Templates Header/WABA Picker Fix · feature-removal ≠ restyle; EL blocked removal without founder sign-off
- **2026-08-11** — V2 Rebrand Slices 1-9 · full Figma rebrand shipped+deployed; per-slice files share the prefix
- **2026-08-06** — Iris Component-Shape Gap · bare components schema → model invents shapes; only live testing catches it
- **2026-08-06** — Iris AUTHENTICATION Template Gap · codeExpirationMinutes missing from tool schema
- **2026-08-06** — Templates Structure B + Meta limits · Meta edit/name/body limits in ConsequenceLine
- **2026-08-06** — Template Studio A− pass · Iris docked confirm + shared preview; CrossWabaHealthStrip max 5
- **2026-08-06** — Iris OpenAI Adapter · 3rd BYOK provider; EL rejected r1 for dead code
- **2026-08-06** — Iris Nav Merge · session sidebar inline in navy rail; icon-only rail rejected by founder
- **2026-08-06** — Iris ChatGPT Redesign · full-bleed layout; Evaluator caught bg-brand-navy content-area anti-pattern
- **2026-08-06** — Client Command Bar · item 45; "all-access" conflicted with Client's staff-grant model
- **2026-08-06** — Shadow Elevation System · named resting/lifted tiers; IconChip/ErrorBanner not yet swept into old call sites
- **2026-08-05** — Inbox lastMessageAt Orphan Fix · @PrePersist stamped lastMessageAt at row creation not message-persist
- **2026-08-05** — Inbox Messages 500 Fix · empty threads were a sort by nonexistent "createdAt"; verify against live logs
- **2026-08-05** — Iris Stuck Thinking · double-send race fixed via isPending guard; NIM 60s hang still open
- **2026-08-05** — Deployment Sync Gap · server was multiple commits behind; full-tree sync + Flyway-history check first
- **2026-08-05** — Full Persona Audit · no fleet/client layer above the per-agent product; tenant-scoping copy-paste is top fix
- **2026-08-05** — EM/EL Origination · "process without origination" gap fixed in EM/EL personas
- **2026-08-05** — PM Vision Depth · persona-pm gained a Product Vision section
- **2026-08-05** — Google-Caliber UX Rigor · persona-ux gained mandatory journey-mapping + micro-detail spec
- **2026-08-05** — UX Creative Ideation Step · mandatory pre-compliance ideation after the generic-pattern taste audit
- **2026-08-05** — Master Roadmap · see wiki/decisions/master-roadmap-2026-08-05.md for the 27-item plan
- **2026-08-05** — Acquisition-Grade Persona Upgrade · Evaluator had rubber-stamped a cross-screen regression; personas upgraded
- **2026-08-04** — Deployment Status · karix-mcp port is 8001 not 8000; separate MySQL DB
- **2026-08-04** — Meta Doc Audit · handoff.enabled semantic bug; agent-onboarding.md/delete-agent.md added
- **2026-08-03** — Iris Scope and BYOK · locked Iris tool allowlist; BYOK provider/model must be closed-set dropdowns
- **2026-08-03** — Karix Credential Model Correction · credentials belong to esme_addr, not WABA
- **2026-08-03** — Template Studio / karix-mcp · karix-mcp matured; EL rejected 3x then approved
- **2026-08-03** — Module Entitlements · account_modules table, fail-closed
- **2026-08-03** — Meta Audit Remediation · 23-item audit; webhook retry data-loss + upload OOM bugs caught

## 2026-07

- **2026-07-29** — MDH Deployment + Nav · MDH deployed via Selenium/UI; grouped Agents sub-nav
- **2026-07-28** — CRUD Completeness Pass · missing GET-single/PUT added; Skills field-name bug fixed
- **2026-07-22** — World-Class Audit · no client-switcher, no test-before-deploy, webhook secret silently optional
- **2026-07-22** — IA Revision · 5-module nav vision, supersedes the 07-18 nav
- **2026-07-22** — 2026-07-22 Build Round · worker's self-reported approval rejected as invalid

## Undated / standing

- **Backend Hardening + Follow-up List** — TASK-033 rate-limit/tenant-check patterns; TASK-034 open
- **Architecture Decisions** — critical architecture/product decisions; every code decision traces back here
- **Spec Locations** — where the product/architecture spec, knowledge index, workflow and infra docs live
- **EL Review Decisions** — logging conventions: JWT parse=debug, webhook parse=warn+preview
- **Frontend Stack Decisions** — Shadcn/ui + Tailwind 3.x, Vite+React18+TS5; Shadcn CLI unreliable
- **Persona System — Four Gates** — PM, EM, EL, UX; PM+EM may batch, EL never batched
- **WABA Flow Decisions** — tenant leak, ownership checks, TSID-as-string, response envelope patterns
- **Task A Wizard Decisions** — TSID ToStringSerializer, HTTP-client timeouts, idempotent FAQ save
- **Design Evaluator Gate** — BLOCKs only on generic AI feel; DESIGN.md §0 signature moves
- **Internal Operator Reframe** — users are internal Karix staff, not self-serve SMB owners
- **Webhook Handoff Signal** — real signal is standby-wrapper presence, not messaging_handovers
- **Client Entity** — client table + client_staff join (not owner_id); phones not duplicated
- **WABA/Account Decoupling** — any account seeing a WABA can manage every agent on it; don't re-warn

---

## Related

- [[lessons/INDEX|Lessons]] — the reusable rules pulled out of this history
- [[sessions/INDEX|Sessions]] — longer per-session writeups
- [[bugs-violations/INDEX|Bugs & Violations]] — incident post-mortems
