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

## Template creation + live send saga — FULLY RESOLVED (2026-08-07)

**FIX-031 status: RESOLVED.** Original hypothesis (Karix outage) was WRONG — corrected in conversation, root cause was ours. Full chain of real, confirmed findings, in order discovered:

### FIX-032 — RESOLVED: karix_esme_credential/phone_esme_mapping data error — real WABA's template creation used the wrong esme_addr credential
- **Severity:** HIGH (was blocking 100% of template creation for this account)
- **Root cause:** phone `1046051241927239` (+91 91520 04195) was mapped to esme credential "North_presales" (`72474400000000`), but per the founder's own authoritative Karix records, that phone belongs on "Test_Call_Ft" (`71226600000018`). Karix's real API rejected every template-creation call with `errorCode 1004 "Unable to resolve template namespace id"` because North_presales's namespace doesn't cover this WABA's template operations the same way.
- **Fix applied:** (1) added the correct "Test_Call_Ft" credential via the app's own `KarixCredentialService.mapToNewEsme` (proper `SecretEncryptor` path, not raw SQL); (2) founder-authorized, scoped single-row SQL correction: `UPDATE phone_esme_mapping SET esme_credential_id=873418092451991552 WHERE id=872758752468537344` — moved exactly the one wrong phone, left the genuinely-correct North_presales mapping (`511710818684002`/+91 96422 01123) untouched.
- **Verified:** Marketing, Utility, and Carousel templates all created successfully afterward with real Meta template IDs.
- **Gate status:** Worker (me) [x] — no EL/PM review yet since this was a live data correction, not a code change. Recommend EM review the `resolveCredential()`/`findFirstByWabaId` "pick first mapping" design (see FIX-034) given tonight proved the choice matters.

### FIX-033 — RESOLVED: Iris's send_test_template sent Meta's numeric fb_template_id, Karix's real API needs the template name
- **Severity:** HIGH — this made Iris's send-test-template tool completely non-functional for any real send
- **Evidence:** live test — sending with `templateId: "1838345740879894"` (numeric) → `{"statusCode":"210","statusDesc":"HSM ID does not exist 1838345740879894"}`; retried with `templateId: "audit_regression_marketing_final"` (name, same JSON field) → `{"statusCode":"200","statusDesc":"Successfully Accepted","mid":"410151060807095733183929"}`
- **Fix applied:** renamed the tool parameter/method signature `templateId` → `templateName` end-to-end (Iris tool schema → `IrisConversationService` → `KarixMessagingClient`), with the tool description now explicitly warning the model never to pass the numeric id. Outbound JSON field to Karix stays `templateId` (their contract), only the value semantics changed.
- **Committed, compiled clean, deployed.**
- **Gate status:** PM [ ] EM [ ] EL [ ] — Fast Track candidate (2 files, contained rename) but not yet reviewed; flag for morning review despite being deployed live under founder's explicit overnight authorization.

### FIX-034 — NOT YET FIXED: `resolveCredential()`/`sendTestTemplate()` both use "pick first mapping found" with no way to choose or correct a wrong one
- **Severity:** MEDIUM — architectural gap, not blocking now that the underlying data is correct, but fragile
- **Evidence:** the original code comment already flagged this as a "pragmatic default... revisit if real Karix behavior ever shows the choice matters" — tonight proved it matters. Additionally: **no API endpoint exists to remap a phone to a different esme credential** once mapped — `mapToNewEsme`/`mapToExistingEsme` both hard-fail with "already mapped" and there's no unmap/update path, forcing a raw DB correction tonight.
- **Recommendation:** (1) add a remap/unmap endpoint; (2) reconsider whether template-credential selection should be explicit (user picks) rather than implicit "first found", especially since tonight showed different esme_addrs under one WABA can resolve differently in Karix's system despite the original assumption that WABA-level approval makes any mapped credential interchangeable.
- **Gate status:** not scheduled — PM/EM decision needed on design before any Worker starts.

### FIX-035 — NOT YET FIXED: `KarixCredentialService.mapToNewEsme()` is non-atomic — credential row can be created without its intended mapping
- **Severity:** LOW — same anti-pattern class as the already-fixed `AiCredentialService.upsert()` (EL H2)
- **Evidence:** live-reproduced tonight — a `mapToNewEsme` call for an already-mapped phone still persisted the new `karix_esme_credential` row before failing on the `PhoneEsmeMapping` unique-constraint conflict, leaving an orphaned-but-valid credential that then blocked a second `mapToNewEsme` attempt with "esme_addr already configured" even though it had zero mappings.
- **Recommendation:** wrap `mapToNewEsme` in `@Transactional` so a failed mapping rolls back the credential too.
- **Gate status:** not scheduled.

### FIX-036 — NOT YET FIXED: media upload endpoint's `category` param is case-sensitive with no clear error guidance
- **Severity:** LOW — `category=IMAGE` (uppercase, matching Meta's own enum convention) is rejected with a correct but easy-to-miss message; only lowercase `image`/`video`/`document` work.
- **Gate status:** not scheduled, cosmetic.

### Live regression templates created tonight (all via our real platform stack, post-fix)
- Marketing: `audit_regression_marketing_final` — fb_template_id `1838345740879894` — **APPROVED**
- Utility: `audit_regression_utility_final2` — fb_template_id `1740789410584110` — PENDING review
- Carousel: `audit_regression_carousel_final2` — fb_template_id `1729155501645550` — PENDING review

### Live test message sent (founder-authorized)
- Template: `audit_regression_marketing_final` (APPROVED)
- From: +91 91520 04195 → To: +918500996740
- Result: Karix accepted, `mid: 410151060807095733183929`

### Founder-supplied reference (not yet used, noted for future media/file-handle work)
Founder shared Meta's Resumable Upload API flow (`/<APP_ID>/uploads` → upload → file handle `h`) as the correct method when a media file handle expires. Not needed tonight (karix-mcp's own `/media` endpoint worked directly for the carousel test), but should be the documented path for any future "expired media handle" recovery flow — flag for whoever builds real UI Skills/carousel authoring (Phase 4 F22).

## Batches 3-5 deployed and verified live (2026-08-07, continued overnight run)

**FIX-037 — found and fixed during live smoke test:** Iris's COMPONENTS_SCHEMA_DESCRIPTION never told the model that a `{{n}}` body variable requires a matching `example.body_text` block. Live-reproduced: OpenAI-backed Iris drafted a UTILITY template with `{{1}}` and no example, correctly rejected by Karix (`"BODY text has placeholders (1) but no example block"`). Fixed schema description, redeployed, retested — Iris then included the example unprompted and the template created successfully end-to-end (`templateId: 2942341826138472`), confirming the full validated tool-execution path (Batch 3's DTO validation fix) works correctly for a real AI-drafted template.

**Test compilation catch:** Batch 3's new `Validator` constructor parameter broke `IrisTemplateCreationScenariosTest.java` (local `mvn compile` doesn't compile test sources, so this was only caught during server-side `mvn package` — fixed before the broken jar could deploy; no bad state reached production).

**Verified after batches 3-5 deploy:**
- Login, WABA list, direct template creation via human-path API — all working
- Full Iris chat flow: session start → draft → confirm → execute → real Karix template created
- WABA relabel from Batch 2 persisted correctly

**Batch 5 root-cause fix (bigger than originally scoped):** the "retired navy" problem (U1/FIX-001) wasn't just a stale `--primary` CSS variable — `tailwind.config.js` itself had `brand.navy: '#160E7A'` (the exact retired hex), `brand.pink: '#E73590'` (should be DESIGN.md's `#D6468F`), and `brand-purple` didn't exist as a Tailwind class at all despite DESIGN.md documenting it and code already referencing it (`ring-brand-purple/40` was a silent no-op everywhere). Fixed the actual Tailwind config to match DESIGN.md exactly, repointed `--primary` at brand-purple (matches its actual usage as secondary-emphasis/focus-ring, never chrome), and aligned the global focus-ring rule to DESIGN.md's literal mandated spec. This is expected to have cascaded fixes to most of the "missing/wrong focus ring" findings from the UX and Design Evaluator audits without per-file edits, since the ring was either wrong-colored or referencing a non-existent class, not literally absent — **not yet re-verified visually, flag for a visual pass once there's browser access again.**

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

## Overnight autonomous fix run (2026-08-07, founder asleep, full authorization given)
**Baseline note:** repo had ~2 days of uncommitted prior work (last commit before tonight was 2026-08-05); consolidated into commit `707b23f` (tag `baseline-pre-audit-2026-08-07`) before any audit fix landed, so rollback stays clean going forward. `.local-keys/` (real JWT/crypto secrets) was found NOT gitignored — fixed in `0d393ea` before any broad `git add`.

**Fixed (bundled into `707b23f` since it landed before the isolation lesson below):**
- QA CRITICAL (Iris session cross-talk / stranded pending confirmation) — `TemplateIrisPage.tsx`: `startNewChat`/`resumeSession` now block while `sendMessage`/`confirmAction`/`cancelAction` is pending, and block (with a clear error) while a confirmation is pending, instead of allowing a switch that could misroute a reply or strand a confirmation. **Note:** the deeper fix from PM's C1 (backend returning `pendingToolName`/`pendingToolArgs` from `getMessages` so a resumed session can rehydrate a genuinely pending confirmation) is NOT done — this fix prevents the corruption/stranding but a session left with a pending confirmation before this fix shipped may still need manual cleanup. Flagged for backend work in a later batch.
- EL H2 (AiCredentialService.upsert non-transactional) — `@Transactional` added.
- FIX-020 (401 interceptor never cleared auth store) — `api.ts` now calls `useAuthStore.getState().clearAuth()` before redirect.
- FIX-013 (AgentDetailPage hand-rolled delete overlay) — now routed through shared `Modal`, preserving the typed-name confirmation.
- FIX-014 (Modal/ConfirmDeleteModal radius drift) — `Modal.tsx` → `rounded-xl`, `ConfirmDeleteModal.tsx` buttons → `rounded-lg`.
- FIX-016 (Modal backdrop-blur / glassmorphism) — `backdrop-blur-sm` removed from `Modal.tsx`, per founder's standing rejection of glass/blur for this product.
- Partial FIX-015 (raw Tailwind colors bypassing tokens) — `ConsequenceLine.tsx`'s hardcoded `amber-700/400` replaced with the `warning` token. Remaining instances (AgentDetailPage HTTP-method map, TemplateBuilderForm, EvalTab, TriggerEventModal, SkillsTab) NOT yet done — queued for the design-token batch.

**Both frontend (`tsc -b --force`) and backend (`mvn -o compile`) verified clean before every commit tonight.**

### FIX-031 — Template creation returns 422 from karix-mcp for ALL payloads, pre-existing (not caused tonight), root cause unconfirmed
- **Found in phase:** overnight regression testing (founder requested creating Marketing/Utility/Carousel test templates)
- **Severity:** HIGH — blocks template creation and therefore any test message send entirely
- **Evidence:** Even the exact minimal payload shape that succeeded at 2026-08-06 19:37:38 (`{"template_name":"diag_direct_test","category":"MARKETING","components":[{"type":"BODY","text":"Direct diagnostic call."}]}` → 201, templateId returned) now fails identically (422) when retried verbatim. karix-mcp's own `api_call_log` table has `response_body`/`error` columns NULL on every failed call — the actual Meta/Karix rejection reason is never captured, anywhere. journalctl only shows the HTTP status line, not the body.
- **Also confirmed:** backend's `GlobalExceptionHandler.handleBusiness()` never logs `BusinessException`/`TemplateStudioException` server-side — only returns the generic message to the client. So this failure mode is invisible in both karix-mcp's AND the platform's own logs.
- **Hypothesis (unconfirmed):** Meta-side template creation rate limit or per-WABA daily quota, given a burst of ~8 consecutive template-creation attempts on 2026-08-06 18:23-18:24 in the same log.
- **Proposed fix:** (1) karix-mcp should persist the actual response body/error on every failed call, not just on success — this is a prerequisite to diagnosing this class of bug at all. (2) Backend's TemplateStudioException should be logged (at minimum `log.warn`) in GlobalExceptionHandler, not silently converted to a generic 400. (3) Once real error visibility exists, re-diagnose the 422 itself.
- **Gate status:** PM [ ] EM [ ] Worker [ ] EL/UX [ ] QA [ ] Committed [ ] — blocks: sending a test WhatsApp message to +918500996740 as founder requested; NOT sent, pending this fix + explicit founder confirmation of sender number

### Founder-requested E2E send (blocked, not yet done)
Founder asked to send a test WhatsApp message to +918500996740 after creating test templates. Blocked by FIX-031 — no template could be created to send with. Real phone numbers live on the demo WABA (494227720434920), any of which would be the sender once unblocked: +91 91520 04492, +91 91520 04283, +91 91520 04195, +91 85916 89475, +91 90100 82954, +91 90100 11634, +91 96422 01123. Do NOT send until founder explicitly confirms which sender number, per his own instruction.

**ROOT CAUSE CONFIRMED (2026-08-07, superseding the "unconfirmed hypothesis" above):** this is a live Karix vendor-side outage, external to this platform entirely. Called `https://rcsgui.karix.solutions/oauth/token` directly (bypassing our backend/karix-mcp) using the real production credentials from `/home/ubuntu/karix-mcp/.env` on the dev box (`KARIX_API_KEY`, `KARIX_WABA_ID=494227720434920` — this is confirmed to be the same real, founder-managed production WABA, not fake/test data) — got `502 Bad Gateway` from Karix's own nginx on 3 consecutive retries (~0.17-0.2s each, i.e. their proxy rejecting immediately, not timing out upstream). DNS + TLS to their host both succeed; the failure is specifically their token-issuing backend. This explains why even a byte-identical payload that succeeded at 19:37:38 yesterday now fails: Karix's service went down sometime after that, unrelated to any of tonight's code changes. **Action:** nothing to fix in our codebase for the 422 itself — monitor Karix's endpoint and retry once it recovers. FIX-031's observability fixes (log the failure body, log BusinessException server-side) remain valid and worth keeping regardless, so the next time any external dependency fails this way it's diagnosable in under a minute instead of requiring a live root-cause investigation.

