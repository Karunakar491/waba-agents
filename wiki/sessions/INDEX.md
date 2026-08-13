---
title: Sessions
tags: [sessions, index, changelog]
---

# Sessions — Running Changelog

## 2026-08-13
- [[session-2026-08-13|Session 2026-08-13]] — Full 8-series Figma build (Agents home/library/wizard), reusable-library pattern extended to Connectors, demo WABA + test-agent DB cleanup, real agent-delete cascade bug found and fixed, and the first fully live end-to-end agent deploy (create → persona → FAQ → skill → deploy → real Meta test response)

## 2026-08-04
- [[session-2026-08-04|Session 2026-08-04]] — Iris redesigned 3x (brand polish → Claude-like → chat history sidebar), WABA picker removed from Iris, self-caught TSID serialization bug, deployment saga (wrong bastion, stray jar trap), local full-stack Docker test environment set up

## 2026-07-20
- [[session-2026-07-20|Session 2026-07-20]] — Backend deployed to server, frontend scaffolded, Obsidian wiki set up

## 2026-07-19
- All 22 backend tasks completed (audit fixes, security, migrations, tests)
- Claude removed from message pipeline — Meta runs AI natively
- AgentDeployService created — deploy/pause via Meta API
- ConversationService split into focused collaborators
- 34 integration + unit tests written

## 2026-07-18
- Architecture spec finalised
- Product design spec (9 P0 screens) finalised

## 2026-07-16
- Platform scaffolded
- Key decisions: MySQL only, Maker-checker, TSID IDs, JWT httpOnly cookie
