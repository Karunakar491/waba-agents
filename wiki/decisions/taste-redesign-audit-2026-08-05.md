---
title: Taste Redesign Audit — Full Project (2026-08-05)
tags: [decisions, ux, audit, taste]
date: 2026-08-05
---

# Taste Redesign Audit — Full Project

Applied `.claude/skills/taste-redesign-audit.md` (adapted from external leonxlnx/taste-skill, MIT) across every page in the app, in 3 passes, in response to the founder's direct feedback that the live UI "still looks dumb."

## The actual answer, not vague taste

Two root-cause primitives, each reinvented wrong repeatedly, account for the large majority of individual findings across all three passes:

1. **No `warning` semantic color token exists.** The shared `StatusIndicator` component itself hardcodes `bg-yellow-500` (a raw, ungoverned Tailwind color) for its `warning` tone. Because there's no real token to point at, at least 3 more files independently invented their own version of "warning yellow/amber" (`AgentsPage.tsx`'s `HEALTH_CONFIG`, `TemplateStudioPage.tsx`'s pending-tile amber, `ConnectorsTable.tsx`'s own color map) — none of them agreeing on a shade, all of them meaning the same thing.
2. **No shared `IconChip` component exists** for the "small tinted rounded box wrapping a Lucide icon" pattern. It's independently re-typed at 4+ different sizes (h-8/h-10/h-12/h-14) across Dashboard, Agent Detail, Agents, Module Selector, Create Agent, Login, and every empty state in the app. This exact recipe — tint + rounded box + centered icon — is the single most recognizable "generic Shadcn admin template" tell, and it's everywhere because there was never one component to hold the line.

**Fixing these two things once resolves a double-digit number of individual findings retroactively** — this is confirmed by all three independent audit passes converging on the same conclusion without being told to.

## Findings by severity (consolidated across 3 passes, ~24 pages/components reviewed)

### Critical
- **Skills and Files pages have zero delete confirmation at all** — worse than a browser popup, the trash-can icon deletes immediately on click (`SkillLibraryPage.tsx`, `FileLibraryPage.tsx`, `SkillsTable.tsx`, `FileWebsiteTables.tsx`). Direct DESIGN.md §5 violation ("destructive actions require confirmation").

### High
- **LoginPage's logo violates DESIGN.md's own named anti-pattern** — a Lucide icon in a rounded navy square as the identity mark, which is the literal first bullet in DESIGN.md §0's ban list, on the first screen every user sees.
- **A native `window.confirm()` popup** for deleting a connector tool (`AgentDetailPage.tsx`) — an unstyled OS dialog next to properly-built modals elsewhere.
- **5+ independently reinvented status pills** not using the shared `StatusIndicator` (`ConnectorsTable.tsx`, `ReportsPage.tsx` ×2 with two different shapes in the same file, `AgentsPage.tsx`'s Health column sitting right next to a correct `StatusIndicator` usage in the same row, `DashboardPage.tsx`'s "No agent deployed" tag, `AgentDetailPage.tsx`'s "Shared WABA" badge).
- **Raw ungoverned Tailwind colors bypassing brand tokens** — `AgentDetailPage.tsx`'s method badges (`blue-50`/`green-50`/`yellow-50`/`orange-50`), `AgentsPage.tsx`'s amber "Shared" chip, and the warning-token gap above.
- **Navy used outside the sidebar/status-band** on `ReportsPage.tsx`'s eval summary card — direct §0 move 2 violation.
- **Dashboard's 4 stat tiles are the exact uniform-grid pattern DESIGN.md already specified a Bento layout to replace** — written into the spec, never built.
- **The tinted-icon-chip pattern**, 10+ confirmed instances across Dashboard, Agent Detail, Agents (×2), Module Selector, Create Agent, Login, Inbox avatars.

### Medium
- **Two simultaneous saturated pink accents in one viewport** on `SkillTemplateBrowsePage.tsx` (two independent filter-chip groups) and `TemplateIrisPage.tsx` (send button + Confirm button visible together) — violates "one accent per viewport."
- **Three to four different tab/segmented-control visual conventions** for the identical "pick one of N" interaction, across Login, Create Agent, Template Settings, Skills, Files, Reports — no shared component, drift confirmed in every file that has one.
- **Iris's `PendingActionPreview`** — the single highest-stakes confirm action in the app ("this cannot be undone") — bypasses the shared `Modal` entirely, rendered as an inline panel instead. May be deliberate (keeps chat visible), but if so it's an undocumented second pattern.
- **Empty-state icon-in-square** recurs on WabasPage, Inbox, AgentsPage despite being DESIGN.md's explicitly named anti-pattern.
- **Missing empty-state CTA** on Inbox's "no conversations" state — names the fix in its own copy, gives no button.
- **Missing/wrong `focus-visible` rings** — repeat instances beyond the original repo-wide sweep, found in WabasPage's search input (zero focus styling at all), Create Agent's wizard fields, Template Studio/Settings inputs (using diluted `focus:` instead of the mandated `focus-visible:` + no `ring-offset-2`).

### Low
- `h-screen` instead of `h-dvh` on the app shell (mobile viewport-jump bug).
- No `text-wrap: balance` on headings anywhere.
- Flat, untinted shadows (cosmetic, not DESIGN.md-mandated).
- Profile's "Plan" badge is pill-shaped but token-correct — flagged only as a future-regression risk if plan tiers ever need color meaning.

## What's already right (confirmed clean, don't re-flag)
- `Modal.tsx` and `StatusIndicator.tsx`'s underlying architecture (focus trap, ARIA, tone enum) is solid — their only real defects are the hardcoded warning color and the lack of an `IconChip`-equivalent sibling.
- `SkillsTable.tsx`, `FileWebsiteTables.tsx`, `WabasPage.tsx`, `WabaDetailPage.tsx`, `InboxPage.tsx`'s `ConversationRow`, and `AgentsPage.tsx`'s Status column (not Health) all correctly use `StatusIndicator` — these are the reference implementations everything else should match.
- Copy/voice quality across the app is genuinely good — consequence lines, plain sentence-case, no corporate clichés found anywhere in 3 passes. The "looks dumb" complaint is entirely visual/structural, not verbal.
- Loading/error/skeleton state coverage is strong app-wide — confirms the 2026-08-05 Phase 0-2 work actually landed correctly.

## Recommended execution order

1. **Add the `warning` semantic token** (`tailwind.config.js` + `index.css`) and point `StatusIndicator` + all 3 duplicate raw-color sites at it. One config change, fixes 4+ findings.
2. **Build a shared `IconChip` component** (or formally kill the pattern per DESIGN.md's own anti-pattern rule) and sweep all 10+ occurrences to it in one pass.
3. **Fix the Critical items**: Skills/Files delete confirmation (route through shared `Modal`), the `window.confirm()` replacement, LoginPage's logo (drop the icon container, wordmark only — this is already DESIGN.md-mandated, just never applied to Login specifically).
4. **Sweep remaining hand-rolled status pills** onto `StatusIndicator` (5+ sites).
5. **Build the Dashboard Bento grid** DESIGN.md already specifies — currently the spec exists and the component doesn't.
6. Medium/Low items as a follow-up pass — tab-bar consistency, focus-visible sweep round 2, empty-state icon removal, viewport-accent conflicts.

## Status

Research/audit only — no code touched. Ready to execute through the normal PM/EM/UX/EL gates per CLAUDE.md; items 1-2 are genuinely one-change-fixes-everywhere and should be built first, same logic as the original Phase 1 sequencing.
