---
title: Full-Product UX Audit (2026-08-05)
tags: [decisions, ux, audit]
date: 2026-08-05
---

# Full-Product UX Audit — 2026-08-05

Journey-first audit of all 18 pages, run in 5 parallel passes. Question asked per screen: why did the user land here, does it fulfill the objective of that moment, is it best-in-world (vs. Linear/Asana/Stripe/Salesforce Agentforce/Intercom), what else could solve this job, would it pass an Apple App Store review bar. Supersedes/extends [[design-evaluator-anti-patterns]] and the earlier pattern-classification pass in [[../../.claude/skills/ui-pattern-classifier.md]].

## Correctness bugs (not taste — these actively mislead the user)

1. **ConnectorsTable hardcodes "Connected" for every row** (`components/connectors/ConnectorsTable.tsx:44-48`) — no real status field exists on `ConnectorRow`. A broken/expired integration will keep showing green "Connected." Highest-priority fix in the whole audit — this is the same *class* of bug as the production login incident (UI confidently lying to the operator).
2. **ProtectedRoute conflates fetch-failure with zero-entitlements** (`components/router/ProtectedRoute.tsx:23`) — `isError || !hasAnyModule` renders the identical "No features enabled, contact your account manager" screen for a transient network blip and for a genuinely zero-access account. This is the exact mechanism that caused a real support-worthy confusion previously logged in [[../bugs-violations/error-message-conflation-2026-08-04]].
3. **ProfilePage "Connect WABA" checklist step is hardcoded `complete: false`** (`ProfilePage.tsx:36`) — never reflects reality regardless of actual WABA connection state.
4. **Persona Deploy has zero confirmation** for a live, customer-facing, irreversible change (`PersonaTable.tsx`) — replacing what a real customer sees on WhatsApp fires from an inline `<select>`+button with no "are you sure" step. Delete has the same gap.
5. **CreateAgentPage's wizard doesn't gate "Publish & Test" on having a connected phone number**, even though `AgentDetailPage` enforces exactly that (`canDeploy`) immediately after — the wizard can complete and fail confusingly on a precondition the rest of the app already knows to check.

## Systemic pattern (found in at least 9 files)

Colored `rounded-full` tinted-background status pills instead of the mandated dot+plain-text token — unfixed in `SkillsTable`, `PersonaTable`, `ConnectorsTable`, `FileWebsiteTables`, `DashboardPage` (×2), `AgentsPage`, `AgentDetailPage` (×3), `WabasPage`, `ProfilePage` (×2), `TemplateStudioPage`. This confirms there is no shared `StatusIndicator` component — every new table re-invents (and re-violates) the same already-documented rule. **Extracting one shared component and replacing all ~13 call sites in one pass is the single highest-leverage fix in this entire audit.**

## Page-container / hierarchy issues

- **DashboardPage**: visual weight is inverted — metrics tiles and a full phone table render above the "needs attention" triage list, when triage is the actual reason someone opens this page. Fix: attention narrative first, with deliberately NO card chrome (contrast against the table below is what makes them read as different kinds of information).
- **WabasPage**: nested `<table>`-inside-`<table>` for WABA→phone drill-down; no search/pagination despite being the definitionally multi-client page; nested table has no scroll wrapper (overflows at 375px). Recommend restructuring to a WABA list → WABA detail route instead of inline expand.
- **TemplateStudioPage**: the manual template builder form is permanently mounted, fully expanded, under the table — every visit (even a 2-second status check) scrolls past a complete create-form. Should gate behind a "+ New template" action using the same reveal pattern already used for edit.
- **TemplateSettingsPage**: the actual primary action when redirected here mid-task ("connect a phone number so Studio unblocks") renders as a small secondary ghost button; the audit log (a debugging aid) is always-rendered at equal visual weight to the primary task.

## Missing Recipe-A requirements (search/filter/pagination on unbounded tables)

AgentsPage, WabasPage, SkillLibraryPage (SkillsTable), FileLibraryPage — all missing search and/or pagination despite being exactly the "operator manages many clients" case the pattern classifier's own test ("if this had 50 rows, would they be lost?") says yes to.

## Journey-coherence gaps (screen is individually fine, product doesn't feel like one thing)

- **TemplateStudioPage ↔ TemplateIrisPage**: zero cross-linking. Two peer nav items both let you create a template with no stated reason to prefer one, no "Edit with Iris" from Studio's table, no "View in Templates" link after Iris confirms a submission.
- **SkillLibraryPage ↔ SkillTemplateBrowsePage**: table vs. row-list are visually inconsistent for what's one conceptual flow ("my skills" vs. "browse to add one"); recommend merging into one page with two tabs, and converting the browse view into an actual card grid (marketplace-style, not a dense row list) — this is a discovery job, not an audit job.
- **LoginPage**: built as a marketing landing page (hero pitch, unverified stat tiles, "Create account" self-serve tab) for a persona that is actually internal daily-use staff, not a self-serve SMB signing up. Escalate to PM/EM — likely the wrong flow, not just the wrong visual treatment.
- **ProfilePage**: onboarding checklist never retires even after every step is complete — permanent chrome for what should be a temporary state; the payload of the page (Business Info) is inert ("editing coming soon") and pushed below the checklist.
- **InboxPage**: confirmed, concretely, as the known "no triage" gap — every conversation row renders identically regardless of open/closed state, no sort-open-first, no status filter, no count badge. Fix is lightweight (Recipe B/F, not a rebuild).
- **ReportsPage eval rollup**: requires a manual "Run rollup" click on every visit with no cached last-run state, and results aren't sorted worst-first — the one view that answers "which agents need me" makes you compute it every time and doesn't even sort by severity.
- **HumanHandoverPage**: literal "coming soon" stub with no CTA at all — the single worst instance of the empty-state anti-pattern in the app (other stubs at least have a next-action button).

## Full per-cluster detail

Five parallel sub-audits were run; full per-page detail (file:line citations, before/after reasoning) is preserved in this session's transcript rather than duplicated here. Clusters: (1) Dashboard/Agents/CreateAgent/AgentDetail, (2) Skill/Persona/Connector/File libraries, (3) Reports/Wabas/Inbox/HumanHandover, (4) Profile/ModuleSelector/Login/ProtectedRoute, (5) TemplateStudio/Iris/Settings.

## Suggested execution order (not yet gate-approved — proposal only)

1. Correctness bugs (5 items above) — these are trust-breaking, not cosmetic.
2. Shared `StatusIndicator` component + replace ~13 pill call sites.
3. DashboardPage reorder (attention-first).
4. Search/filter/pagination on the 4 under-built tables.
5. Journey-coherence fixes (Studio↔Iris cross-links, Skills tab-merge, Inbox triage, ReportsPage caching+sort).
6. LoginPage/ProfilePage/WabasPage structural rework (larger, needs PM sign-off on flow changes, not just visual).
