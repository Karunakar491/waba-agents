# Knowledge index: root

One line per file, `path — purpose`. **Grep it. Never read it whole.**

    Grep pattern="AgentService" path=docs/knowledge-index/

A line points at a file; it does not narrate its history. Keep each under ~200
chars. A purpose needing a paragraph belongs in the file, in `TASKS.md`, or in
`wiki/`, not here.

Split by area so each file stays reviewable. A grep across the directory
searches all of them at once.

.claude/agents/design-evaluator.md — Outside eye on taste, separate from the reviewer. BLOCKs only on generic/AI-generated feel; mandatory cross-screen drift and craft checks. Benchmarks against Linear/Stripe/Vercel.
.claude/agents/reviewer.md — The review gate before commit. Reads job + STATE.md + diff + surrounding code, selects lenses from what changed (design for frontend/src, docs-vs-implementation for Meta API, kill-switch for scripts and migrations). Replaces EL, UX, QA, DevOps.
.claude/skills/taste-redesign-audit.md — NEW 2026-08-05 — external design-taste checklist adapted from leonxlnx/taste-skill (MIT), scoped as a supplement to DESIGN.md/persona-ux/persona-design-evaluator, never an override.
boris-SKILL.md — Boris skill notes — proactive engineering workflow guidance
CLAUDE.md — Master constitution — personas, standards, non-negotiables, file pointers
DESIGN.md — Design system single source of truth — agent guide preamble, S0 visual theme (5 signature moves + AI-template anti-patterns), S0.1 breakpoints, tokens, typography, spacing, S5 15-item interaction …
karix-mcp/ — Separate Python/FastMCP service (own README, own tests, own deploy — NOT part of this platform's Java build).
karix-mcp/karix_mcp/__init__.py — Empty package marker for the karix_mcp module; contains no code.
karix-mcp/karix_mcp/api_call_logger.py — Logs every outbound Karix API call to the api_call_log MySQL table with allowlist-style key-name redaction of secret fields (mirroring the Java platform's ApiCallLogRedactor); never logs headers, …
karix-mcp/karix_mcp/app.py — Starlette entry point wiring together the MCP SSE/streamable-HTTP transports, OAuth routes, Template Studio REST routes, and AuthMiddleware (Bearer-JWT gate on /sse, /mcp, and /api/*, live-reading …
karix-mcp/karix_mcp/auth.py — OAuth 2.0 authorization server for Karix MCP: validates ESME address/API key against Karix, issues/decodes HS256 JWTs, implements PKCE S256 verification and an in-memory authorization-code store, and …
karix-mcp/karix_mcp/builders.py — Pure functions that assemble Karix RCM sendMessage request bodies for each message type (text, template, media, reply-buttons, list menu, CTA URL) around a shared _base() envelope.
karix-mcp/karix_mcp/bulk_import.py — Parses an .xlsx sheet of fixed-format columns into template specs (no LLM normalization by design), persists the job/rows to MySQL, and processes template creation in a bounded background thread pool …
karix-mcp/karix_mcp/config.py — Single source of env-driven constants — Karix send/template base URLs and the MCP server's listen port.
karix-mcp/karix_mcp/credentials.py — Resolves per-request Karix credentials (api_key, waba_id, esme_addr) from JWT claims injected by AuthMiddleware, falling back to env vars for single-tenant dev; sender_id is deliberately excluded …
karix-mcp/karix_mcp/db.py — Thin no-ORM MySQL access layer (one connection per call via pymysql) for template_drafts, bulk_import_jobs/rows, and api_call_log tables — tenant-scoped reads by esme_addr throughout.
karix-mcp/karix_mcp/karix_client.py — Thin HTTP wrapper around the Karix RCM/template REST API (send_message, list/get/create/delete/edit_template, upload_media) with shared retry-on-5xx and centralized audit logging via api_call_logger; …
karix-mcp/karix_mcp/rest.py — Starlette REST endpoints for Template Studio (create/list/get/edit/delete template, upload media, bulk import + status, audit log) that call the exact same template_ops/bulk_import/db functions as …
karix-mcp/karix_mcp/server.py — Defines the FastMCP tool surface (get_sender_details, list/describe/create/delete_template, and the send_* message tools) exposed to Convogent/Claude Desktop, wiring credential resolution, builders, …
karix-mcp/karix_mcp/template_ops.py — Shared template create/delete/list/get/edit/upload_media logic called by both the MCP tools (server.py) and the REST layer (rest.py) so the two entry points can never diverge; create_template …
karix-mcp/karix_mcp/templates.py — Normalizes raw Karix template list responses into compact dicts, provides list/describe with search+truncation and name/id lookup, and validates that a send's param_values count matches the …
karix-mcp/karix_mcp/validator.py — Validates a Karix-shaped template payload against Meta's real rejection rules (ported from karix-superagent's templateValidator.js) before submission — category/name/body-length checks, …
Meta Business Agent mdh_spices postman_collection 8 July v2.json — Postman collection — Meta Business Agent API calls for mdh_spices test business (8 July v2)
scripts/ledger-check.js — Stop hook. Warns, never blocks, when commits or uncommitted changes touched frontend/src, backend/src/main or scripts without STATE.md moving too.
scripts/orient.js — The ORIENT beat. Offline, read-only: deploy drift vs master, branches ahead of master, the open job and whether it carries proof, top Broken entries, always-on context budget.
scripts/session-context.js — SessionStart hook. Injects STATE.md so reality arrives without anyone remembering to load it.
STATE.md — The ledger: what is live, what is broken ranked by user impact, what is in flight, the constraints bounding any task. Read before starting, write before closing. Injected at SessionStart.
TASKS.md — Running task list — 22 tasks covering audit fixes, architecture decisions, implementation, deployment
TECH-STACK.md — Approved tools and versions — Shadcn/ui + Tailwind replaces Ant Design as of 2026-07-20
wiki/api/INDEX.md — Wiki API section index
wiki/architecture/INDEX.md — Wiki architecture section index
wiki/architecture/messaging-stack.md — Wiki — messaging stack architecture (webhooks, idempotency, retention)
wiki/architecture/schema.md — Wiki — database schema notes
wiki/architecture/system-overview.md — Wiki — system overview (Meta runs AI natively, we are the config layer)
wiki/bugs-violations/INDEX.md — Wiki bugs/violations section index
wiki/bugs-violations/violations-2026-07-20.md — Wiki — process violations log 2026-07-20
wiki/decisions/2026-08-12-iris-generalization-plan.md — PLAN artifact (not yet built): extracts IrisConversationService's hardcoded template-specific tool list/prompt/dispatch into an IrisToolProvider interface so Iris can serve other features beyond …
wiki/decisions/INDEX.md — Wiki decisions section index
wiki/decisions/maker-checker.md — Wiki — maker-checker gate decision record
wiki/decisions/stack-frontend.md — Wiki — frontend stack decision (Shadcn/Tailwind over Ant Design)
wiki/deployment/INDEX.md — Wiki deployment section index
wiki/deployment/lessons.md — Wiki — deployment lessons (9 hard-won AWS deploy lessons)
wiki/deployment/runbook.md — Wiki — production deploy runbook (bastion SSH path, systemd, /var/www/metaagent)
wiki/docs/INDEX.md — Wiki docs section index
wiki/frontend/brand.md — Wiki — Karix brand notes (superseded by DESIGN.md for authority)
wiki/frontend/INDEX.md — Wiki frontend section index
wiki/INDEX.md — Obsidian wiki root index — project knowledge vault entry point
wiki/sessions/INDEX.md — Wiki sessions section index
wiki/sessions/session-2026-07-20.md — Wiki — session log 2026-07-20
