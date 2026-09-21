# Knowledge index — docs

One line per file: `path — purpose`. **Grep it. Never read it whole.**

    Grep pattern="AgentService" path=docs/knowledge-index/

A line points at a file; it does not narrate its history. Keep each under ~200
chars — when a purpose needs a paragraph, the paragraph belongs in the file, in
`TASKS.md`, or in `wiki/`.

Split by area so each file stays reviewable; a grep across the directory
searches all of them at once.

# Knowledge index — docs
chars — when a purpose needs a paragraph, the paragraph belongs in the file, in
docs/audit_index.py — Drift audit script — diffs knowledge-index.json against files on disk; run after any batch of changes
docs/infrastructure.md — AWS server details — SSH bastion (13.232.241.246), app server (10.1.17.16), installed services, ports, credentials (dev only).
docs/knowledge-index.json — This file — flat codebase index, updated on every approved change
docs/specs/2026-07-18-architecture.md — System architecture — component diagram, data flows, full schema, API surface, security, async topology, caching, deployment, risks
docs/specs/2026-07-18-product-design.md — PM spec — all UX/product decisions: nav structure, wizard flow, WABA onboarding, dashboard, reports, P0/P1 screens
docs/specs/2026-07-22-ia-revision.md — Supersedes nav IA in 2026-07-18-product-design.md — 5-module structure (Dashboard/Agents/Connectors-Skills-KB-FAQ library/Chat Conversation/Profile-Customer); flags module-3 WABA-level shared library …
docs/specs/2026-07-22-world-class-audit.md — Full PM+UX+Design Evaluator+EM audit — reframes users as internal operators (not consumer SMB owners); ranked findings: no client-switcher, no test-before-deploy, inbox has no triage, webhook secret …
