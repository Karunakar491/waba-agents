---
title: Acquisition-Grade Craft Audit (2026-08-05)
tags: [decisions, ux, audit, accessibility]
date: 2026-08-05
---

# Acquisition-Grade Craft Audit — 2026-08-05

Second-pass audit applying the newly-added "Acquisition-Grade Bar" sections in `persona-ux.md` / `persona-design-evaluator.md` (accessibility, motion craft, edge cases, scale, cross-screen drift) across all 18 pages. Does NOT repeat findings from [[full-product-ux-audit-2026-08-05]] (correctness bugs, journey issues, the original pill-badge count) — this is strictly the new layer.

## Headline: the app-wide gaps (found identically in all 5 clusters, confirmed by repo-wide grep, not per-page speculation)

1. **Zero `focus-visible:` styling anywhere in `frontend/src`.** No interactive element on any page has a visible keyboard-focus indicator beyond whatever the browser default does (frequently suppressed by Tailwind's reset). This is REJECT-grade per the persona's own new rule, confirmed across all 18 pages, not isolated.
2. **Zero `active:`/pressed states anywhere.** Every button in the app is hover-only — a click gives no tactile "this registered" feedback before the network round-trip resolves.
3. **No modal in the app has a real focus trap, `role="dialog"`, or reliable Escape/backdrop-dismiss** — checked across `SkillEditorModal` (closest to correct: has `role="dialog"`+`aria-modal`+Escape, but no trap), `AddWabaModal` (fails all three), and by inference the AgentDetailPage modals (`ThreadControlModal`, `AddConnectorModal`, `AddToolModal` — fail all three).
4. **`prefers-reduced-motion` is never referenced anywhere in the codebase** (0 grep hits) — moot today since there's almost no motion to reduce, but every `animate-pulse`/`animate-spin` usage is unconditional.
5. **No shared `StatusIndicator` component exists** (0 grep hits) — confirmed the colored-pill anti-pattern count from the first audit is now higher than originally tallied: two more instances found in `TemplateStudioPage.tsx:270-281` and `TemplateSettingsPage.tsx:102-107`, pushing the known total past "9+ files."
6. **Unbounded, unvirtualized, unmemoized lists everywhere data can realistically exceed ~50 rows** — Iris chat history + session sidebar, Settings audit log, Reports API-calls log + eval rollup, Inbox conversations + messages, every library table's rows. None use `React.memo` on row components; several recompute filters/counts on every render with no `useMemo` even where a sibling file does memoize the equivalent computation (inconsistent even within the same feature).

## Findings unique to one surface, ranked by severity

- **Iris's chat message list has no `aria-live` region** — screen-reader users get zero announcement of Iris's replies or its "thinking" state. Single highest-severity finding on the product's flagship AI surface.
- **Iris's "thinking" indicator is literally just pulsing text** (`animate-pulse` on a sentence) — the most-seen animation in the whole product is also its least considered.
- **LoginPage's form fields have no `htmlFor`/`id` association** — despite `CreateAgentPage`'s own `Field` component already doing this correctly. A regression against an established in-house pattern, on the one screen every user must pass through.
- **A second and third instance of the "loading/error silently collapses into empty/false" bug class** (same species as the audit's already-logged ConnectorsTable/ProtectedRoute lies): `ProfilePage`'s agents query defaults to `[]` on both loading and error, and `ModuleSelectorPage` renders every module as disabled while entitlements are still loading, indistinguishable from genuinely-not-entitled.
- **Race condition in Iris**: Enter-to-send is only guarded on the button's `disabled`, not on the input's Enter-key path — a slow response plus a double-Enter can fire two messages before the first resolves.
- **No RTL/`dir="auto"` handling anywhere**, most consequential on Iris's live WhatsApp-bubble preview, which explicitly promises "nothing here is inferred silently" — a misrendered RTL preview breaks that promise specifically.
- **`WabasPage`'s `AddWabaModal`** fails focus-trap, `role="dialog"`, Escape-to-close, and backdrop-click-dismiss simultaneously — the most complete instance of the app-wide modal gap.
- **`ReportsPage`'s eval-rollup polling has no terminal timeout state** — a user can be left on "Running…" forever with no failure path if polling exhausts attempts.
- **Cross-tab state leak in `FileLibraryPage`**: `deletingId` is shared across Files and Websites mutations with no namespacing — a coincidental ID collision would show a delete-spinner on the wrong row.

## What was explicitly NOT assessed (disclosed per the new persona requirement — do not treat as clean)

- No live screen-reader (NVDA/VoiceOver) session was run — all ARIA findings are a static read of markup.
- No numeric WCAG contrast-ratio measurements were taken — color-only-signaling was flagged structurally, not via a contrast tool.
- No live performance profiling at 500+ rows was run — every performance finding is reasoned from the literal absence of `useMemo`/`React.memo`/virtualization in the code as written, not measured.
- No real usability test with an actual ops staffer has happened on any of these 18 pages.

## Where this leaves the "would Apple/Google buy this" question

Two of the six headline gaps (#1 focus-visible, #3 modal accessibility) are the kind of thing that fails an actual Apple App Store accessibility review, not just an internal taste bar — both are cheap, both are systemic (fix once at the design-token / shared-component level, not per-page), and both should be prioritized ahead of any further visual polish work.

## Suggested execution order (proposal only, not yet gated)

1. App-wide `focus-visible:` ring (one Tailwind/CSS change, fixes all 18 pages at once).
2. Shared `Modal` primitive with real focus trap + `role="dialog"` + Escape/backdrop-dismiss, retrofitted into all ~8 existing modal components.
3. Shared `StatusIndicator` component (now confirmed 11+ call sites, up from 9).
4. Iris: `aria-live` region + a real typing indicator + the Enter-to-send race fix — highest-visibility flagship-surface fixes.
5. Fix the two new loading/error-collapse instances (ProfilePage agents query, ModuleSelectorPage entitlements loading).
6. Everything else in the per-cluster punch lists (RTL/dir handling, list virtualization, memoization) as a broader hardening pass.
