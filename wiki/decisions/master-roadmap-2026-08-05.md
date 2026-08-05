---
title: Master Roadmap — Consolidated From All 2026-08-05 Audits & Vision Docs
tags: [decisions, roadmap, ux, product-vision]
date: 2026-08-05
---

# Master Roadmap — What To Actually Do

Single consolidated execution plan combining five documents produced in this session:
- [[full-product-ux-audit-2026-08-05]] — journey-level UX audit, all 18 pages
- [[acquisition-grade-audit-2026-08-05]] — accessibility/craft/scale audit
- [[product-vision-meta-capability-surface-2026-08-05]] — UI Skills, eligibility, proactive triggers, IA
- [[meta-templates-rcm-ai-vision-2026-08-05]] — Template gaps, Karix RCM, Iris scope
- This session's chat — bulk-upload-to-templates, KB-driven suggestions (new asks, not yet a written doc — captured here for the first time)

Nothing below has been through PM/EM/UX/EL gates yet. This is the prioritized "what to do" — gating happens per item as work starts, per CLAUDE.md's maker-checker process. **Every item, without exception, is subject to the "Production Data — Sacrosanct" rule in CLAUDE.md — no migration, deploy, or data script proceeds without a verified backup and explicit sign-off where that rule applies.**

## Phase 0 — Trust bugs (do first, cheapest, highest-damage-if-left) — ✅ SHIPPED 2026-08-05

All 6 items built, EL-approved (one round-trip: initial REJECT for a `useEffect`-for-data-fetching violation in `CreateAgentPage.tsx`, fixed with `useQuery`, re-reviewed, APPROVE), knowledge index updated. These actively mislead the person using the product. Not taste, not polish — the product currently lies in these six places.

1. `ConnectorsTable.tsx` hardcodes "Connected" for every row — no real status field exists. Fix: add real status to `ConnectorRow`, drive the badge from data.
2. `ProtectedRoute.tsx` conflates network failure with zero-entitlements — same bug that caused the real production login incident. Fix: split into a retry state (system fault) vs. locked state (business fact).
3. `ProfilePage.tsx` "Connect WABA" checklist step hardcoded `complete: false` — never reflects reality. Fix: wire to real WABA-connection state.
4. Persona Deploy fires a live, customer-facing, irreversible change with zero confirmation. Fix: confirm modal, consequence line, before any deploy/delete.
5. `CreateAgentPage` wizard doesn't gate "Publish & Test" on a connected phone number, unlike `AgentDetailPage` which enforces this same rule right after. Fix: same precondition check in both places.
6. (Found in the acquisition-grade pass, same bug class) `ProfilePage`'s agents query and `ModuleSelectorPage`'s entitlements-loading state both collapse "loading/error" into "empty/disabled" indistinguishably. Fix: explicit error state, distinct from empty/disabled.

## Phase 1 — Systemic component extraction (fixes dozens of instances in ~2 focused builds)

`DESIGN.md` already updated and passed a cold Design Evaluator gate (PASS, 2026-08-05) covering everything in this phase — the tokens/patterns below are approved to build against, not still under discussion.

**Items 7, 8, 10, 12 (mechanical) ✅ SHIPPED 2026-08-05** — EL-approved on first pass. `StatusIndicator` component built and swapped into 8 files (SkillsTable, PersonaTable, FileWebsiteTables, DashboardPage, AgentsPage, AgentDetailPage x3, WabasPage, TemplateStudioPage — ~11 individual call sites); `--radius` bumped 0.5rem→0.75rem (softens every `rounded-lg` app-wide with one token change); mandatory `focus-visible:` ring added globally in `index.css`; loading-state sweep found and fixed the only remaining blank-render instance (`App.tsx`'s `RootRedirect`, same bug class as `ProtectedRoute`). Knowledge index updated.

**Item 9 (shared Modal primitive) ✅ SHIPPED 2026-08-05** — retrofitted into all 9 hand-rolled modals (DeleteFromMetaModal, BusinessPersonaLibraryPage's deploy-confirm, SkillEditorModal, RunToolModal, TriggerEventModal, ConnectPhoneModal, AgentDetailPage's ThreadControlModal/AddConnectorModal/AddToolModal, WabasPage's AddWabaModal). EL caught a real bug on first pass — the focus-trap effect depended on `preventClose`, so every mutation `isPending` flip re-ran trigger-capture/initial-focus/cleanup and yanked focus out of the modal mid-action on every single one of the 9 call sites. Fixed by tracking `preventClose` via a ref read inside the keydown handler, with the main effect mount/unmount-only. Re-reviewed, approved. Real pre-existing gaps closed along the way: `ThreadControlModal` and `AddWabaModal` had no `role=dialog`/Escape/focus-trap at all before this; `TriggerEventModal`'s Escape fired with zero pending-guard.

**Item 11 (Bento layout) — deliberately deferred, not a gap.** `ModuleSelectorPage` already renders as an equal-weight 2-card grid — true Bento (size varying by content weight) has nothing to differentiate on with only 2 symmetric modules today; forcing it would be cosmetically identical to what exists. `DashboardPage` Bento is coupled to the Phase 2 reorder (attention-narrative-first) which hasn't shipped yet — building it against the current unordered structure would just mean redoing it. Revisit both once Phase 2 ships / a 3rd module exists.

7. **Shared `StatusIndicator` component** (dot + plain text, never a tinted pill) — replaces 11+ confirmed independent violations across `SkillsTable`, `PersonaTable`, `ConnectorsTable`, `FileWebsiteTables`, `DashboardPage`×2, `AgentsPage`, `AgentDetailPage`×3, `WabasPage`, `ProfilePage`×2, `TemplateStudioPage`, `TemplateSettingsPage`. One component, ~13 call sites updated in one pass. Now specified in `DESIGN.md` §6.
8. **App-wide `focus-visible:` ring** — zero instances exist anywhere in `frontend/src`. One Tailwind/CSS token change fixes all 18 pages simultaneously. REJECT-grade accessibility gap per the upgraded UX persona. Now a mandatory token row in `DESIGN.md` §2.
9. **Shared `Modal` primitive** with real focus trap, `role="dialog"`, `aria-modal`, Escape-to-close, backdrop-dismiss, initial-focus management — retrofit into `AddWabaModal`, `ThreadControlModal`, `AddConnectorModal`, `AddToolModal`, `SkillEditorModal` (closest to correct today — has dialog role + Escape, still missing the trap), `TriggerEventModal`, `RunToolModal`, `DeleteFromMetaModal`, `ConnectPhoneModal`. Now specified in `DESIGN.md` §4/§6.
10. **Visual system refresh** — radius scale softened app-wide (buttons/inputs 8px→12px `rounded-xl`, cards/modals 12px→16px `rounded-2xl`), closer to Apple's current visual language. Every component using the old `rounded-lg`/`rounded-xl` mix needs a pass to the new scale — do this in the SAME build as items 7-9 since all four touch the same component files, not as a separate pass.
11. **Bento panel layout** — `DashboardPage` and `ModuleSelectorPage` only (explicitly not tables/forms/chat/wizards — see `DESIGN.md` §6 for the scoping rule). Cards vary by content weight, render through `StatusIndicator`/agent-preview/`ConsequenceLine` rather than inventing card-local UI, and must specify single-card and content-overflow behavior before ship (Design Evaluator's one open note on this item).
12. **Loading-state audit** — `DESIGN.md` §5's "no blank render during a fetch" rule already existed but wasn't enforced; `ProtectedRoute.tsx`'s `null`-return during entitlement checks (already tracked in Phase 0 item 2) is the confirmed instance. While rebuilding components for items 7-11, sweep for any other screen returning blank/nothing during a load instead of a spinner/skeleton — same violation class, same pass.

## Phase 2 — Page-level coherence (journey fixes, not component swaps) — ✅ SHIPPED 2026-08-05

All 9 items built across 6 EL-reviewed chunks (A-F), each independently approved (two required one fix-and-re-review round: Chunk B's mutation/unmount-timing bug, already fixed; Chunk F's row-accessibility polish, fixed proactively before it became debt). Chunk D (item 19) required a new backend endpoint (`GET /eval-rollup/latest`) — correctly caught by EM as breaking the original "frontend-only" assumption, built with its own tenant-scoping and reviewed accordingly; surfaced one real pre-existing gap as a tracked follow-up (`poll(jobId)` has no tenant check — see `TASKS.md`). Chunk F (item 14b, `WabaDetailPage`) needed no new backend surface after all — reused an already tenant-checked existing endpoint, confirmed via a micro PM+EM gate before building.

13. **DashboardPage reorder** — "needs attention" narrative first (no card chrome, deliberately), metrics second, phone table last. Currently inverted relative to why anyone opens this page.
14. **WabasPage restructure** — kill the nested table-in-table for WABA→phone; move to a WABA detail route. Add search + pagination (currently absent on the one page that's definitionally multi-client).
15. **TemplateStudioPage** — gate the manual builder form behind a "+ New template" action (currently permanently expanded under the table on every visit). Add `useMemo` to counts/filter/pagination (currently recomputed on every render against an unbounded client-fetched list).
16. **Studio ↔ Iris cross-links** — "Edit with Iris" from Studio's table; "View in Templates" link after Iris confirms a submission. Currently zero connection between two screens that do the same job.
17. **Skills ↔ SkillTemplateBrowse merge** — one page, two tabs ("My Skills" / "Browse Templates"); convert Browse into a real card grid (marketplace-shaped, not a dense row list).
18. **Inbox triage** — sort open-first, color-code open vs. closed, add a status filter chip row, add an "Open (N)" count. Currently every row renders identically regardless of urgency.
19. **ReportsPage eval rollup** — auto-load last completed rollup on tab mount instead of requiring a manual click every visit; sort worst-score-first; add a terminal timeout state (currently can poll forever with no failure path).
20. **HumanHandoverPage** — replace the bare "coming soon" stub with at minimum a next-action prompt/CTA; currently the single worst empty-state instance in the app (zero CTA at all).
21. **LoginPage flow question (needs founder/PM decision, not just a UI fix)** — built as a marketing landing page for a persona that's actually internal daily-use staff. The self-serve "Create account" tab may be the wrong flow entirely for an internally-provisioned tool. Escalate before touching.

## Phase 3 — Meta capability surface (new capability, needs its own PM+EM gate)

22. **UI Skills → fold into existing Skills editor** as a "Response format" field (Text/Carousel/CTA/Flow/Image/List/Location), not a new tab. Real capability gap: zero UI exists for Meta's rich-message API today.
23. **Eligibility pre-check** — inline badge at the phone-picker step of the agent-creation wizard, before the user invests in configuring skills/knowledge/connectors.
24. **Proactive triggers** — reframe `TriggerEventModal` from a buried debug button into "Connectors → Proactive triggers": connector receives a business event → agent proactively messages the customer. Named as the single most differentiating capability found across both vision docs — most competitor WhatsApp AI tools only do reactive Q&A.
25. **Persistent status header on AgentDetailPage** — real connection status (fixes #1 above), last eval score/date, last test date, always visible above the tabs. Answers "is this safe to leave running tonight" without tab-hopping.

## Phase 4 — Template/RCM maturity (mostly ordinary backlog, one real blocker)

26. **Authentication-category (OTP) templates** — real blocker, a client literally cannot do this today. Prioritize ahead of the other three below.
27. Multi-language template families, pre-approved-template-library import, pacing/quality-tier visibility next to the existing quality score — ship as ordinary backlog, no vision-level gate needed.
28. **RCM in-session delivery mechanism** — wire `build_buttons`/`build_list`/`build_cta` (found working, zero current callers) into the Skills response-format field from #22, auto-selected based on 24-hour conversation-window state, invisible to the ops person. Highest-leverage single bet in the RCM vision doc: uses code that already works, closes a real gap, adds zero new screens. **Must stay invisible — no "Karix RCM" tab, channel selector, or brand name in the UI, ever.**

## Phase 5 — New asks from this session (not yet documented elsewhere until now)

29. **Bulk content upload → auto-generated templates.** Ops person uploads a spreadsheet of raw business content (product catalog, order-status set, appointment types); system proposes one template per row/group through Iris's existing confirm-before-create flow, reviewed as one batch screen before anything touches Meta. Reuses the existing Iris create-template tool as the entry point — not a new AI risk surface, a new way to feed the same reviewed pipeline at scale. Open questions before build: free-form vs. column-mapped input; auth-template handling; partial-batch-failure behavior (submit-what's-good vs. all-or-nothing).
30. **Knowledge Base → template suggestions.** Iris cross-references an agent's existing FAQs/Files/Websites to proactively suggest templates ("I see you have a return policy — want a return-confirmation template?") instead of waiting to be asked. This is the properly-built version of "recommend the best template for the occasion" — grounded in real business data, not guesswork.

## Explicit no-build list (carried forward from both vision docs — do not reopen without a real reason)

- No standalone "UI Skills" page/tab.
- No "Karix RCM" tab, page, channel selector, or brand name anywhere in the UI.
- No pitching RCM as "multi-channel" or "SMS/RCS fallback" — the code only supports WABA, hardcoded.
- No unified "AI configures any rich message" mega-tool for Iris — different risk profiles (approval-gated vs. config-time vs. live) must not collapse into one tool surface.
- No connector-logs BI dashboard, no mTLS cert upload UI, no exposing Meta's onboarding sequencing as visible wizard steps, no `followup` setting treated as a headline feature, no template-library-import or pacing dashboard treated as vision-level.

## Suggested sequencing logic

Phase 0 before anything else — these are correctness bugs, not features, and the cheapest fixes with the highest trust payoff. Phase 1 next because two of its three items (StatusIndicator, focus-visible ring) are genuinely one-change-fixes-everywhere and de-risk every later phase's UI work. Phase 2 is where the product stops feeling "assembled" — do this before adding any new capability, since new features built on an incoherent IA just add more incoherence. Phases 3-5 are net-new capability and each needs its own PM+EM gate before code starts, per CLAUDE.md — none of them are "just fix it" tasks.

## Status

**Phases 0, 1, and 2 are fully shipped (2026-08-05)** — 18 items, PM+EM gated before any code, every chunk EL-reviewed (several with a real first-pass REJECT, fixed and re-approved — the process caught genuine bugs, not just style nits: a focus-trap effect that yanked focus on every mutation, a success message that never painted before its form unmounted, a raw `window.history` call that could stale-reprefill Iris's input, a missing tenant check surfaced and tracked rather than silently shipped). Knowledge index current throughout. Two durable engineering lessons banked to memory for future sessions (`feedback_react_effect_stale_deps`, `feedback_mutation_success_unmount_race`).

**Phases 3-5 remain not started** — genuinely new capability (UI Skills, proactive triggers, RCM wiring, OTP templates, bulk-upload-to-templates, KB-driven suggestions), each still needs its own PM+EM gate before a line of code, per CLAUDE.md. Recommended order unchanged: 26 → 24 → 22 → 28 → 29 → 30 (blocker fix, then the two highest-leverage new capabilities, then the two build-on-top items).

One open item tracked outside this roadmap, in `TASKS.md`: `EvalRollupService.poll(jobId)` has no tenant-ownership check — not yet scheduled.
