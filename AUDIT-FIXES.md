# AUDIT-FIXES.md — Bible Violation & Fix Log

Every violation of CLAUDE.md found during the full audit (see AUDIT-TASKS.md) is logged here before any fix is attempted. Format per finding:

```
### FIX-XXX — <title>
- **Found in phase:** N
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **CLAUDE.md rule violated:** <quote or section>
- **File(s):**
- **Evidence:**
- **Proposed fix:**
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]
```

---

## Phase 1 violations (see AUDIT-TASKS.md for full detail)

### FIX-001 — Retired navy hex (#160E7A) still live as `--primary`, used as content-area brand color + focus ring app-wide
- **Found in phase:** 1 (UX, finding U1)
- **Severity:** CRITICAL
- **CLAUDE.md rule violated:** DESIGN.md token single-source rule ("hardcoded/stale token = EL REJECT"); persona-ux Hard Rule ("brand-navy on a card/table row/modal = REJECT"); focus ring must be `brand-purple/40`
- **File(s):** frontend/src/index.css:15, CreateAgentPage.tsx, AgentsPage.tsx, DashboardPage.tsx, SettingsPage.tsx, LoginPage.tsx, WabaDetailPage.tsx
- **Evidence:** `--primary: 244 80% 27%` = `#160E7A`, the exact hex DESIGN.md's 2026-08-06 rewrite retired in favor of `#11225F`; never migrated
- **Proposed fix:** update `--primary` to correct Karix Blue Zodiac value or remove and replace all `bg-primary`/`text-primary`/`ring-primary` usages with correct brand-purple/pink tokens per component role; needs full gate sequence (UX + Design Evaluator + EL, >400 line diff likely → split by page)
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-002 — Dense tables have no mobile fallback (375px baseline broken)
- **Found in phase:** 1 (UX, finding U2)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** DESIGN.md §0.1 "single column, no horizontal scroll" at 375px
- **File(s):** DashboardPage.tsx (PhoneNumbersTable), AgentsPage.tsx (main table), WabaDetailPage.tsx (phone table)
- **Proposed fix:** add `md:` stacked-card fallback for each table; UX to spec pattern once, reuse across all three
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-003 — Bare spinner loading states instead of layout-matching skeletons
- **Found in phase:** 1 (UX, finding U3)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** DESIGN.md State Completeness rule (named anti-pattern: "spinner in center of blank page")
- **File(s):** WabaDetailPage.tsx:61-65, TemplateStudioPage.tsx:36-38
- **Proposed fix:** build skeleton matching final layout, same pattern as DashboardPage/AgentsPage already use
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-004 — No onboarding gate / sequencing enforcement (WABA → Agent → Templates/Iris/Library)
- **Found in phase:** 1 (PM, findings F2, F3, F4)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** PM persona thesis (anticipatory defaults, not silent empty states); no explicit bible rule but a core product-quality gap
- **File(s):** ProtectedRoute.tsx, CreateAgentPage.tsx, all Library pages, TemplateStudioPage.tsx
- **Proposed fix:** PM/EM decision needed on enforcement mechanism (route guard vs. disabled nav vs. forced wizard step) before Worker scoped — flagged for Phase 4 roadmap prioritization
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-005 — Orphaned SettingsPage.tsx left in tree, unrouted, contains billing/delete-account UI
- **Found in phase:** 1 (PM, finding F5)
- **Severity:** MEDIUM
- **CLAUDE.md rule violated:** Karpathy Rule / dead-code discipline ("code that isn't understood/used shouldn't be in production")
- **File(s):** frontend/src/pages/SettingsPage.tsx
- **Proposed fix:** delete or re-route and reconcile with ProfilePage — Fast Track eligible if deletion only (<30 lines net effect on routing, but file deletion itself needs EL sign-off since it's not purely mechanical)
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-006 — `h-screen`/`min-h-screen` instead of `h-dvh` (ProtectedRoute, LoginPage) — mobile viewport jump
- **Found in phase:** 1 (UX)
- **Severity:** MEDIUM
- **CLAUDE.md rule violated:** DESIGN.md §8 named anti-pattern
- **File(s):** ProtectedRoute.tsx:18,46,70, LoginPage.tsx
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-007 — Hand-rolled StatusIndicator duplicates instead of importing shared component
- **Found in phase:** 1 (UX)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** persona-ux Rule 7 ("if the Worker invents a new pattern for a solved problem, I reject")
- **File(s):** SettingsPage.tsx:78-81,96-101, ProfilePage.tsx:148-153,180-183
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-008 — Banned "centered icon + text" empty-state pattern
- **Found in phase:** 1 (UX)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** DESIGN.md §4 named anti-pattern; persona-ux Step 3 automatic REJECT
- **File(s):** ReportsPage.tsx (ApiCallsLog, line ~298-308), SkillLibraryPage.tsx:128-134, ConnectorLibraryPage.tsx:46-52, NotFoundPage.tsx
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-009 — Raw Tailwind palette colors bypassing StatusTone/token system
- **Found in phase:** 1 (UX)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** Token Compliance (persona-ux Step 1 grep target)
- **File(s):** AgentDetailPage.tsx:976-980 (METHOD_BADGE), :363 (amber preflight banner), AgentsPage.tsx:216 ("Shared WABA" tinted pill)
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-010 — InboxPage: hardcoded `bg-white` (breaks dark mode), no mobile collapse, `-m-6` layout hack
- **Found in phase:** 1 (UX, finding U5)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** DESIGN.md semantic-token rule, Mobile-First gate
- **File(s):** InboxPage.tsx
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-011 — Focus-visible rings missing on nearly all buttons across Template/Skill/Connector/File/Persona library pages
- **Found in phase:** 1 (UX)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** persona-ux "Focus Ring — Every Interactive Element"
- **File(s):** TemplateStudioPage.tsx, TemplateSettingsPage.tsx, TemplateIrisPage.tsx, SkillTemplateBrowsePage.tsx, SkillLibraryPage.tsx, ConnectorLibraryPage.tsx, FileLibraryPage.tsx, BusinessPersonaLibraryPage.tsx
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

## Phase 2 violations

### FIX-012 — No central Button/Input/Card component; 115 hand-rolled buttons, 32 hand-rolled inputs
- **Found in phase:** 2 (F11)
- **Severity:** CRITICAL
- **CLAUDE.md rule violated:** DESIGN.md §5 component-pattern reuse; Karpathy Rule (no abstraction despite overwhelming repetition — inverse failure)
- **File(s):** 17 of 21 page files (buttons), 8 files (inputs)
- **Proposed fix:** extract shared `Button` (variant/size/loading) and `Input` (baked-in focus ring) primitives; large multi-file migration — needs PLAN artifact first (>3 files), phased rollout page by page
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-013 — AgentDetailPage hand-rolls delete-confirm overlay instead of ConfirmDeleteModal (regression)
- **Found in phase:** 2 (F12)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** DESIGN.md §5 Modal pattern ("every dialog renders through one component")
- **File(s):** AgentDetailPage.tsx:2060-2062
- **Proposed fix:** replace with `<ConfirmDeleteModal>` — Fast Track eligible (single file, <30 lines)
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-014 — Radius drift baked into shared Modal/ConfirmDeleteModal primitives themselves
- **Found in phase:** 2 (F13)
- **Severity:** MEDIUM
- **File(s):** Modal.tsx:106 (rounded-2xl → should be rounded-xl), ConfirmDeleteModal.tsx:54,64 (rounded-xl → should be rounded-lg)
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-015 — Raw Tailwind palette colors inside shared ConsequenceLine + feature components, no dark-mode variants
- **Found in phase:** 2 (F14)
- **Severity:** MEDIUM
- **File(s):** ConsequenceLine.tsx:21, AgentDetailPage.tsx:363,976-980, TemplateBuilderForm.tsx, EvalTab.tsx, TriggerEventModal.tsx, SkillsTab.tsx
- **Proposed fix:** map to `warning`/semantic tokens; propose new named tokens for HTTP-method colors per DESIGN.md's escalation path
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-016 — Modal.tsx backdrop uses backdrop-blur-sm (glassmorphism, banned with no stated exception)
- **Found in phase:** 2 (F15)
- **Severity:** MEDIUM — needs Design Evaluator judgment call, not an automatic fix (see [[feedback_glassmorphism_rejected]] — founder already rejected glass/blur for this product)
- **File(s):** Modal.tsx:96
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

## Phase 3 violations
**Build status confirmed: frontend `tsc -b --force` 0 errors; backend `mvn -o compile` 0 errors (full `mvn test` not run — follow-up).**

### FIX-017 — 14 TSID entities missing @JsonSerialize(ToStringSerializer) — User.id highest-impact
- **Found in phase:** 3 (F17)
- **Severity:** HIGH
- **CLAUDE.md rule violated:** EL checklist — TSID string serialization on every exposed field
- **File(s):** AgentPerformanceHourly, ConversationSession, WebhookEvent, ClientAuditLog, ClientStaff, AiProviderCredential, IrisMessage, AccountModule, BusinessAccount, **User**, KarixEsmeCredential, PhoneEsmeMapping, Waba, WabaAccountAccess, WebhookRaw (all :18-34 range, entity id field)
- **Evidence:** 14 other entities (Agent, Conversation, Message, Skill, Client, IrisSession, PhoneNumberSnapshot, ApiCallLog) already do this correctly with identical comment; frontend authStore.ts:5 types User.id as JS `number`
- **Proposed fix:** add annotation to all 14; verify via controller grep whether any expose these entities directly (not via DTO) before treating as low-risk in practice
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-018 — ConversationStore write methods don't scope findById by accountId (tenant guard relies on caller discipline only)
- **Found in phase:** 3 (F18)
- **Severity:** MEDIUM
- **CLAUDE.md rule violated:** EL checklist — naked findById without tenant/access guard
- **File(s):** domain/conversation/service/ConversationStore.java:44,70,100
- **Proposed fix:** change to `conversationRepository.findByIdAndAccountId(conversationId, accountId)`, mirroring `AgentSkill.findByIdAndAgentId` pattern already used elsewhere
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-019 — One `as any` cast in frontend (isolated, not a pattern)
- **Found in phase:** 3 (F19)
- **Severity:** LOW
- **File(s):** AgentDetailPage.tsx:2156
- **Proposed fix:** type the settings response properly — Fast Track eligible
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-020 — 401 interceptor redirects to /login without clearing persisted Zustand auth store
- **Found in phase:** 3 (F20)
- **Severity:** MEDIUM
- **File(s):** frontend/src/lib/api.ts:9-18, frontend/src/store/authStore.ts:24
- **Proposed fix:** call `useAuthStore.getState().clearAuth()` synchronously before the redirect
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

## Phase 4 findings (Meta API gap analysis — see AUDIT-TASKS.md for full roadmap)

### FIX-021 — agent_onboarding endpoint never called; open since 2026-08-04, never escalated
- **Found in phase:** 4 (F21) — **Severity:** MEDIUM (spike, not a bug)
- **File(s):** AgentService.createAgent()
- **Action:** EM spike against live sandbox before any code change — do not wire in speculatively
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-022 — UI Skills API (carousel/CTA/interactive-list/location) completely unbuilt
- **Found in phase:** 4 (F22) — **Severity:** MEDIUM, highest confirmed product-value gap in the audit
- **Proposed fix:** new `agent_ui_skill` entity + service (mirror existing Skills pattern) + frontend authoring UI, excluding `flow` component type (depends on already-declined WhatsApp Flows)
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ] — Plan-First required (>3 files)

### FIX-023 — agent_event has backend support, zero frontend surface
- **Found in phase:** 4 (F23) — **Severity:** LOW, likely by design (external-system-triggered, not admin-UI-triggered)
- **Gate status:** not scheduled — P2 at best

## Consolidated P0 (see AUDIT-TASKS.md Phase 4 roadmap table for full EM feasibility notes)
1. F1 — no embedded WABA signup (BLOCKED on Meta Tech Provider status — external dependency, not pure eng)
2. FIX-001/U1 — retired navy hex still live as --primary system-wide
3. FIX-020/F20 — 401 interceptor never clears auth store
4. F2 — no onboarding gate

## Phase 5 findings (live dev-server audit, read-only — see AUDIT-TASKS.md for full detail)
**Confirmed clean:** all core services running per docs; app health endpoint UP; DB schema + Flyway history (V1-V36) fully match local migrations; demo@karix.online exists (owner role, 1 WABA, 15 agents — all draft/paused, none active).

### FIX-024 — Deployment drift: OpenAiAdapter.java (3rd BYOK provider, EL-approved 2026-08-06) missing from server source tree
- **Found in phase:** 5 (F24) — **Severity:** HIGH — recurrence of known "Deployment Sync Gap" pattern (see [[project_deployment_status_2026_08_05]])
- **Evidence:** 213 of 215 backend files present on server; running jar predates the OpenAI BYOK feature
- **Live impact:** selecting OpenAI as Iris BYOK provider in prod hits a nonexistent code path
- **Proposed fix:** full redeploy (sync missing files) before Phase 6 E2E touches Iris
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ] — DevOps review required (deploy task)

### FIX-025 — Redis has no password live; docs say requirepass MetaAgent2024
- **Found in phase:** 5 (F25) — **Severity:** MEDIUM — config/reality drift on a security control
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-026 — AnalyticsService NPE live in logs, 25 occurrences, most recent 2026-08-06, silently drops analytics events
- **Found in phase:** 5 (F26) — **Severity:** MEDIUM, live-confirmed bug
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-027 — WebhookController drops "unattributable" payloads for unmapped phone_number_ids
- **Found in phase:** 5 (F27) — **Severity:** LOW-MEDIUM, live-confirmed, unclear if test noise or real gap — needs triage before scoping
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

## Phase 6 findings (live browser E2E via Playwright against demo@karix.online — see AUDIT-TASKS.md for full question-by-question results)
**9 of 10 founder QA questions tested live or code-confirmed; 1 partial, 2 fails.**

### FIX-028 — Guessable /agents/create URL throws raw backend 500 instead of 400/redirect
- **Found in phase:** 6 (F28) — **Severity:** MEDIUM, live-confirmed
- **Evidence:** real route is `/agents/new`; `/agents/create` falls into agent-detail route
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-029 — Refreshing mid-wizard preserves step position but silently wipes entered field data
- **Found in phase:** 6 (F29) — **Severity:** HIGH, live-confirmed — worse than a simple reset, UI falsely signals progress was preserved
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### FIX-030 — Iris with zero WABAs: setup banner shows but chat composer stays enabled
- **Found in phase:** 6 (F30) — **Severity:** MEDIUM, code-confirmed (not live-reproducible on demo account, which has a seeded WABA)
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ]

### Also noted
- No global 403 handling in api.ts — only 401 is intercepted; module-entitlement 403s are handled well via a dedicated component, but that's route-specific, not global (PARTIAL on Q3)
- One new draft test agent was created on demo@karix.online during wizard testing (normal app usage, not a DB write) — all 15 pre-existing agents and other accounts untouched

## ALL 6 PHASES OF THE GENERAL AUDIT COMPLETE (F1-F30) + separate Iris/Template deep-dive (see AUDIT-IRIS-CONSOLIDATED.md)
