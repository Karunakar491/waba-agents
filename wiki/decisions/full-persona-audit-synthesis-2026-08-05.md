---
title: Full 4-Pass Persona Audit — Synthesis (2026-08-05)
tags: [decisions, audit, synthesis, ux, el, em, pm]
date: 2026-08-05
---

# Full 4-Pass Persona Audit — Synthesis

Four independent passes applying each persona's newly-upgraded origination section against the real codebase/product. Not a repeat of prior generic taste/accessibility audits — each pass targeted the specific gap the persona was just fixed for.

- UX (journey mapping + micro-detail): `wiki/decisions/journey-micro-detail-audit-2026-08-05.md`
- EL (code craft origination): this doc, section 2
- EM (architectural vision): this doc, section 3
- PM (product vision): this doc, section 4

## 1. Cross-cutting theme

All four passes converged on the **same root failure independently**: this product is well-built at the single-agent/single-screen/single-service level and structurally missing the layer above it.

- UX: screens don't carry *why the operator is here* or *what they just did* across transitions.
- EL: the same sync/error/status pattern is reinvented 4-13x instead of extracted once (the same discipline that produced `StatusIndicator`/`Modal` didn't propagate to the next instances).
- EM: tenant-scoping (`existsByWabaIdAndAccountId`) is hand-copied across 8+ call sites instead of routed through one guard — the highest-stakes repetition of the EL pattern, since a missed copy is a cross-tenant leak, not a cosmetic bug.
- PM: the entire product is agent-scoped; there is no client-level (fleet) view anywhere — the single biggest gap between "good tool" and "category-defining tool."

**One fix pattern — "extract on the 3rd instance" — is the throughline for EL/EM. One fix pattern — "carry context forward, don't discard it" — is the throughline for UX/PM.**

## 2. EL — Code Craft Origination (full findings)

1. `AgentService.java` — four verbatim-shaped sync engines (`ensureXBackfilled` ×4, `reconcileX` ×3) never extracted into a shared `MetaMirrorReconciler`. ~230 lines collapsible to ~50.
2. `AgentService` name lies — actually 5 services glued together (CRUD/Skills/FAQ/Files/Websites). Split recommended: `AgentService` + `AgentSkillService`/`AgentFaqService`/`AgentContentSyncService`.
3. `extractMessage(err)` reimplemented identically in **13 files**. Extract to `lib/errors.ts::extractErrorMessage`.
4. Error-banner markup copy-pasted in **10 files** alongside #3. Extract shared `<ErrorBanner>`.
5. Table skeleton/empty-state duplicated across 4 table components — `FileWebsiteTables.tsx` already has the fix locally (`TableSkeleton`/`EmptyState`), just never promoted to `components/shared/`.
6. Three unrelated concepts all named `reconcile*` — no bug, but ambiguous vocabulary at 3x surface; worth a 1-paragraph ADR.
7. Positive counter-example: `AgentService.deleteAgent`'s comment is craft done right — cited as the bar the rest of the file should meet.

**Verdict**: nothing is a rule violation; the codebase has good bones and honest comments, but hasn't applied its own best habit (extract on repetition) to its two biggest offenders (backend sync engines, frontend error handling).

## 3. EM — Architectural Vision (full findings)

1. **[BOUNDARY-RISK, highest priority]** Tenant-scoping check copy-pasted across 8+ files (`AgentService`, `SkillLibraryService`, `AgentDeployService`, `TemplateStudioService`, `KarixCredentialService`, `KarixMessagingClient`, `WabaService`, `WabaAgentReconciliationService`, `PhoneNumberAccessGuard`). One missed call site = cross-tenant leak. Fix: single `WabaAccessGuard.requireAccess(wabaId, accountId)`, same pattern as existing `AgentAccessService`.
2. **[BOUNDARY-RISK]** Webhook signature verification silently skips on empty config with only a WARN — inconsistent with the stated "fail fast at startup" principle for the most attackable entry point.
3. **[BET]** `MetaApiClient` as sole Meta gateway — real platform bet, already paying off (accumulated quirk-knowledge lives in one place).
4. **[BET]** `waba_account_access` as the real ownership primitive — correct long-term shape, already reused across 3 domains.
5. **[DEBT, named correctly]** Karix credential model churned twice in a month — acceptable, self-documented as "revisit if needed," flagged only so the revisit actually happens.
6. **[DIFFERENTIATION]** Meta quirk-knowledge (agent_id scoping, multi-channel array ordering, reconciliation drift-detection) is a real moat — hard to replicate without live-Meta incidents. Recommend consolidating into one reference doc.
7. **[DEBT, named correctly]** No shared retry/circuit-breaker policy for external calls — fine as accepted debt, should be named consistently everywhere, not just where a comment happened to get written.
8. **[DIFFERENTIATION — explicitly not attempted]** Auth/JWT/entitlements/MySQL rollups correctly left as the boring, undifferentiated choice.

**2-year point of view**: today's domain boundary is the right one to keep building on, contingent on fixing #1 soon. The one boundary EM would *not* keep as-is: WABA-level sharing conflates "who can see" with "who can edit" — fine today, real risk once staff/permission granularity increases. Recommends folding a lightweight per-action permission check into the same `WabaAccessGuard` fix, so it's one piece of work, not two later refactors.

## 4. PM — Product Vision (full findings)

**3-year category call**: not "a config layer over Meta's APIs" (commoditized in 2 quarters by any funded competitor) — the category-defining version is a **fleet command center**: the only place an ops team needs to be to run 200+ agents across dozens of clients unattended, judged on "can I tell, from inside this product, that it's safe to leave every agent running tonight."

**Love vs. tolerate**: accurate status/focus-traps/confirmations = tolerate (floor, not differentiator). Love = product reconstructs *why you're here* before you ask (ties directly to UX's triage-reason finding), prevents customer-facing mistakes before they happen (not just explains after), and opens the day with a fleet-wide risk ranking instead of a flat per-agent list.

**Market opinion**: commoditizing fast — template CRUD, phone/WABA management, plain-text agents, and (despite the effort) the entire accessibility/polish layer — necessary, not differentiating. Real moat if built right — proactive business-event triggers (already roadmap item 24) and a genuine multi-client fleet layer (not currently on the roadmap at all).

**Day-in-the-life gap**: an 18-client ops person has no way to see "which of my clients have a problem" — only a flat un-scoped agent list. Confirms and extends UX's triage-reason and no-acknowledgment-loop findings: multiply by 18 clients and "trust that a fix landed" becomes the single biggest recoverable daily time-sink.

**3 originated ideas, ranked**:
1. **Client Command Bar** — persistent, app-wide client switcher + fleet-risk ranking; every page (Dashboard/Inbox/AgentDetail) reads its scope from it. The structural gap underneath the category bet itself — ranked #1 because everything else (proactive triggers, per-agent polish) is worth more once this exists and easy to miss without it.
2. **Fleet-wide "did my fix land" signal** — Dashboard's attention list reflects a resolution without manual refresh/rescan, at the level ops actually manages from.
3. **Proactive-trigger fleet audit trail** — extends roadmap item 24: once triggers exist, need a cross-client view of which are live, when each last fired, and any silent failures (a client's customer never told their order shipped = zero UI signal today).

## 5. Recommended roadmap update

Add **Phase 7 — Structural Gaps (this audit)** to `wiki/decisions/master-roadmap-2026-08-05.md`:
- 7a. `WabaAccessGuard` extraction (EM #1) — security-priority, do first, small/contained
- 7b. Webhook signature fail-fast (EM #2) — security-priority
- 7c. `extractMessage`/`ErrorBanner` extraction (EL #3/#4) — mechanical, low-risk, high duplication removed
- 7d. `AgentService` backfill/reconcile → `MetaMirrorReconciler` (EL #1)
- 7e. Table skeleton/empty-state promotion (EL #5) — smallest item, do alongside 7c
- 7f. Client Command Bar (PM idea A) — largest, needs its own PM+EM gate before any code; this is a new IA primitive, not a page fix
- 7g. Fleet-wide fix-confirmation signal (PM idea B) — depends on 7f
- 7h. `AgentService` split into 4 services (EL #2) — larger refactor, sequence after 7d since 7d changes the code being split

Items 7a-7e are mechanical/contained and could proceed through gates similarly to Phase 0-2. Items 7f/7g are new product surface and need a full PM+EM vision gate (not just an EL implementation gate) before any code, per CLAUDE.md's maker-checker process — they are the kind of decision the process exists for, not busywork to route around.

## Status
Audit complete, no code touched. This synthesizes all 4 passes (UX/EL/EM/PM) from the "thorough audit like yesterday" request. Master roadmap not yet edited — pending user direction on whether to fold Phase 7 in now or discuss scope first.
