---
title: Journey Mapping & Micro-Detail Audit (2026-08-05)
tags: [decisions, ux, audit, journey]
date: 2026-08-05
---

# Journey Mapping & Micro-Detail Audit

Applied the newly-upgraded `persona-ux.md` (Creative Ideation + Google-Caliber Rigor sections) against three core end-to-end journeys and three shared components. Prior audits covered generic taste/accessibility; this is journey-continuity and state-completeness only — new findings, not repeats.

## Journey A — Monday morning triage (Login → Dashboard → flagged agent → resolve)
**Bail point**: AgentDetailPage lands on the Knowledge Base tab regardless of why the operator arrived — a "disconnected" agent (top triage priority) opens on the wrong tab entirely (should be Connectors/Settings).
**Moment that matters, currently under-crafted**: the instant an operator confirms a flagged item is actually fixed. Zero acknowledgment loop exists — no "you just resolved X," operator must manually navigate back to `/` and reread the list.
**Transition gap**: Dashboard→AgentDetail click carries only an agent ID, never the triage `reason` — a real "does the next screen know what happened on the previous one" failure.
**Fix**: carry `reason` as router state; tab-route by reason type; contextual banner naming why they're here.

## Journey B — Create + deploy a new agent (5-step wizard → connect phone → verify live)
**Moment that matters, currently under-crafted**: Step 4 ("Connect") is a static placeholder card with zero action — the single highest-stakes step (going live with a real client) gets *less* craft than Step 2's tone-picker (which has an AI-generation flourish and live chat preview).
**Transition gap #1**: Step 4→5 re-fetches phone-connection state fresh over the network instead of carrying it forward from the same data just autosaved seconds earlier.
**Transition gap #2 (the big one)**: wizard finish() calls `/deploy` then discards that context — lands on the same generic Knowledge Base tab as any stale agent, no "you just published this" framing despite the wizard knowing exactly what just happened.
**Fix**: make Step 4 a real embedded connect flow or relabel it honestly; pass `justPublished` state on exit; auto-surface Test Agent / success banner.

## Journey C — Iris creates a template, verify it landed
**Moment that matters, currently under-crafted**: clicking "View in Templates →" — the entire payoff of the journey (did it actually work?) — routes to a generic `/templates` link that drops the exact `wabaId` the confirm handler already had in hand one line earlier. Operator must re-pick the WABA and manually scan the table for their new template with no highlight/sort/scroll-to.
**Fix**: pass `wabaId`/template identity on the link; preselect + highlight on arrival.

## Micro-detail state matrices (built from actual source, not assumed)

**`StatusIndicator`**: default/success/partial-error specified; hover/focus/loading/long-content/empty **missing or inconsistent per-caller**. `pulse` is a code-comment convention, not enforced — nothing stops a future caller misusing it on a non-live tone.

**`Modal`**: focus/disabled/long-content genuinely well-specified (real Tab-trap, restore-focus). **Success state entirely missing** — every modal's success path is "mutation resolves → close immediately," zero acknowledgment beat, even for weighty actions (WABA register, Thread Control release). Error banner markup hand-duplicated identically across 4+ modals instead of a shared `<ModalError>`.

**`WizardNav`**: loading/disabled well done. Focus-visible ring missing (inconsistent with the file's own form-input treatment). **`StepGoLive` — the wizard's highest-stakes step — doesn't even use the shared `WizardNav` component**, hand-rolls its own buttons instead, meaning the one screen where consistency matters most is the one exception.

## Prioritized fixes
1. Wizard-exit continuity (`justPublished` state → AgentDetailPage success banner)
2. Dashboard triage-reason continuity → AgentDetailPage contextual tab/banner
3. Iris→Studio link carries WABA/template identity, highlights on arrival
4. Add a real success acknowledgment beat to `Modal` (at minimum: WABA register, Thread Control release)
5. Extract shared `<ModalError>` — 4+ duplicate hand-typed copies found
6. Focus-visible rings on `WizardNav`
7. Refactor `StepGoLive` to use `WizardNav` instead of hand-rolled buttons
8. `CreateAgentPage` Step 4: make it a real action or relabel honestly

## Status
Audit only, no code touched. First of a planned 4-pass fresh audit (UX done; EL code-craft, EM architecture-vision, PM product-vision passes were paused mid-session for a context compaction — resume from here, not from scratch).
