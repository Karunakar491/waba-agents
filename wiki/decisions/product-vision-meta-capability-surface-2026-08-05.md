---
title: Product Vision — Full Meta Capability Surface & Acquisition-Bar UI (2026-08-05)
tags: [decisions, product-vision, ux, meta-api]
date: 2026-08-05
---

# Product Vision — What This Product Should Become

Joint PM + UX read of all 18 `docs/meta-api/` files against the current codebase (`backend/.../domain/`, `frontend/src/pages/`), following on from [[full-product-ux-audit-2026-08-05]]. That audit found trust bugs and inconsistency. This is the harder question: even if every bug above is fixed, is the *shape* of the product right? Research (agent-run doc read + codebase grep) is summarized in the appendix table; this document is the opinionated call built on top of it.

Research-only, no code touched.

## 0. What "best-in-class" means for THIS product (not generic SaaS)

This is not a self-serve SMB tool. It is an **internal console Karix ops staff use to run WhatsApp AI agents for other people's businesses, all day, across many clients.** The user is never the end-customer chatting on WhatsApp — they are the person accountable when that chat goes wrong. Two consequences follow, and almost everything below traces back to them:

1. **The console's job is to make the ops person feel in control of something that runs autonomously without them.** The agent acts on WhatsApp 24/7 without a human in the loop per-message. The UI's entire value is: configure it correctly, verify it behaves, catch it when it doesn't. Every screen should be judged against "does this help someone hold an autonomous system accountable for a client they didn't build the agent for personally."
2. **Multi-client is not a feature, it's the whole premise.** An ops staffer manages N clients' agents in one sitting. Any pattern that works for "one agent, one admin" but breaks under "50 clients, need to scan/compare/triage" is not done, no matter how polished the single-agent view looks (this is the audit's Recipe-A finding, extended: it also applies to *new* surfaces we're about to add, not just old tables).

What would make an Apple/Google-caliber reviewer say "built by people who understood the problem," specifically here:
- **The rich-message capability (UI Skills) is presented as a natural extension of "how do I make this agent good," not a bolt-on API wrapper.** A reviewer who reads `ui-skills.md` and then opens the product should see it reflected in the actual conversation-building mental model, not find it missing or find it as an unrelated 7th tab titled "UI Skills."
- **Every status the console shows is real**, per the audit — this is table stakes for "control something you can't see," not a nice-to-have.
- **The eval loop and the test loop and the deploy loop are one visible loop**, not three disconnected verbs. An ops person should be able to answer "is this client's agent safe to leave running unattended tonight" from inside the product, in one place, without reconstructing state across tabs.

## 1. UI Skills — where rich messages belong

`ui-skills.md` documents a separate CRUD surface (`agent-ui-skills`) for `carousel_quick_reply`, `carousel_url`, `cta_url`, `flow`, `image`, `interactive_list`, `location`, `location_request` — each with `title`, `component_type`, `status`, `instruction`, and (for flows) a `flow_id`. Confirmed zero references anywhere in `frontend/src` and no backend controller/entity for it. This is real: a text-only agent cannot request a shipping address, offer a product carousel, or push a WhatsApp Flow — and every serious competitor agent product (and every WhatsApp BSP worth acquiring) treats rich components as first-class, not experimental.

**The wrong answer** is a "UI Skills" tab next to "Skills." Two tabs both named some variant of "skill," one plain-text and one rich-component, is exactly the disconnected-tabs failure mode the founder is trying to escape, and it forces the ops person to hold in their head which tab a given behavior lives in.

**The right answer:** Skills is already "teach the agent to do a thing." A plain Skill and a rich-message Skill are the *same conceptual object* — an instruction plus an optional attached component — not two systems. Concretely:

- Keep **one Skills surface**. Each skill row gets an optional **"Response format"** field, default `Text` (today's plain-text skill, no change), with options `Carousel`, `Call-to-action button`, `Flow`, `Image`, `Interactive list`, `Location`, `Request location`. Selecting a non-Text format reveals the component-specific fields inline in the same skill editor (carousel items, CTA URL, flow picker, etc.) — the same modal, one more section, not a new page.
- The skill's existing `title`/`description`/`instruction`/`channel` fields map directly onto `ui-skills.md`'s fields; `component_type` becomes the response-format selector; `status` (draft/published) reuses whatever publish-state pattern Skills already has.
- Flow attachment (`flow_id`) is the one place this needs an opinion beyond "it's a field": show a flow picker only once the account has a published Meta Flow, and if none exists, the field explains that in plain language rather than accepting a raw ID — this is exactly the kind of Meta-plumbing-vs-user-facing translation this product exists to do.
- This means: no new tab, no new nav item, no new mental model. The Skills tab becomes strictly more capable, and the "is this skill plain-text or rich" distinction is a property of a skill, the way "channel" already is.

## 2. Two other gaps worth building, with concrete UI

Out of the confirmed gap list (appendix), two others clear the "genuine differentiator, not plumbing" bar. (`connectors.md`'s `/logs` stats-endpoint and mTLS-certificate gaps are real but are execution debt on an existing surface, not new product — see §4.)

### 2a. Eligibility pre-check (`eligibility.md`)

Today `CreateAgentPage` presumably lets someone attempt to provision an agent on a phone number with no upfront signal on whether Meta will actually allow it — and the audit already flagged the wizard doesn't even gate on a *connected* phone number before publish. Eligibility is the same class of problem one step earlier: **an ops person can spend the whole wizard flow only to be told at the end that the number was never eligible.**

Proposal: eligibility is not a page, it's a **precondition badge inline in the phone-number picker step of the agent-creation wizard** — the moment a number is selected, fire the eligibility check and show a plain-language result (`Eligible` / `Not eligible — [reason if Meta gives one]`) before the user invests in configuring skills, knowledge, connectors. If ineligible, the "Next" action disables with the same explanatory pattern used for the flow-picker above. This directly extends the audit's already-flagged wizard-gating fix (item 5) — same root cause, same fix shape, worth doing together.

### 2b. Business-event triggers as a real capability, not a hidden test button

`agent-event.md` (POST arbitrary business-event notification, e.g. order-shipped, appointment-reminder) is already wired end-to-end technically — `TriggerEventModal.tsx` exists — but it is buried as an ops debugging tool inside `AgentDetailPage`, not presented as what it actually is: **the mechanism for an agent to proactively message a customer about something that happened in the client's business system.** That is a genuinely different capability from "answer inbound questions," and today's UI hides it inside what reads like a manual test button.

Proposal: this is where **Connectors and business-events meet** — a connector tool that fires on a webhook from the client's system (order placed, shipped, appointment booked) *is* a business event, and today those are two unconnected concepts (Connectors = pull data in via API when asked; agent-event = push a proactive message). Give this its own small section under Connectors — "Proactive triggers" — where an ops person configures "when this connector receives X, send this business event with this payload," turning today's manual "Trigger test event" button into an actual proactive-messaging feature. This is the single most differentiating capability in the whole audit if surfaced right: most competitor WhatsApp AI tools only do reactive Q&A.

## 3. Information architecture: does the 6-tab AgentDetailPage still work?

**No — not because tabs are wrong, but because two of the additions above don't want to be tabs, and forcing them to be tabs is how a coherent product turns into a stack of disconnected feature-flags.**

Making the actual call, not deferring it:

- **Knowledge, Skills, Connectors, Business Profile, Eval, Settings survive as the top-level structure** — they map onto real distinct ops-mental-model categories (what the agent knows / what it can do / what it can reach / who it represents / is it good / how does it behave), and nothing above argues for collapsing them.
- **UI Skills does not get a tab** — it's absorbed into Skills per §1. This is the concrete rejection of "add a 7th tab" the brief asked for.
- **Eligibility does not get a tab** — it's a wizard-time gate, it has no ongoing configuration state once the agent exists, so it has no business living in the persistent detail page at all.
- **Proactive triggers gets a sub-section of Connectors, not a tab** — per §2b, it's conceptually "what the connector does when triggered," which is a property of connectors, not a peer of them.
- **The one real structural change:** add a **thin persistent header inside AgentDetailPage, above the tabs** — not a tab itself — showing three always-visible signals regardless of which tab is open: real connection status (fixing the audit's hardcoded-"Connected" bug), last eval score/date, and last test date. This directly answers §0's "is this agent safe to leave running tonight" question without requiring the ops person to click through Eval and Settings and Connectors separately to reconstruct it. This is a header-bar addition, not a new IA node — cheap, and it's the piece that makes six independent tabs read as "one agent's status," not six separate configuration forms.

Net effect: still six tabs. Two capability gaps absorbed into existing tabs where they conceptually belong. One cross-cutting status header added above the tabs, because "is this safe" is not a per-tab question and a 6-tab structure has nowhere else to answer it.

## 4. What should NOT be built

Real product judgment includes the no-list:

- **A standalone "UI Skills" page/tab.** Explicitly rejected in §1 — this is Meta's API shape, not the user's mental model, and copying an API's resource boundary into the nav is the exact anti-pattern this whole exercise is trying to correct.
- **Exposing `connectors.md`'s `/logs` `include_stats`/`top_n` failure-ranking as a dashboard/BI feature.** It's real and useful, but it's execution debt on the *existing* Connectors surface (build a logs view that already has a backend endpoint), not new product vision — file it as a build task off the existing audit, not a headline capability.
- **mTLS certificate upload UI.** Genuine gap (`upsertCertificate` has no frontend field), but it is enterprise-connector plumbing for a small fraction of client integrations, not something that changes what the product *is*. Ship it as an unglamorous form field addition when a client actually needs mTLS, not as part of a vision-level redesign.
- **A general-purpose "webhook standby/handoff" status widget as new UI.** `webhook-standby-handoff.md` documents a *server-side detection rule correction*, not a missing user capability — the existing Human Handover stopgap work already covers the user-facing side (per memory: `project_webhook_handoff_signal`). Re-litigating it here would be solving an already-solved problem under a new name.
- **`agent-onboarding.md`'s async provisioning step as a visible wizard stage.** It's a backend orchestration detail (entity creation + data-prep jobs) that should stay invisible — the wizard should show a single "Setting up your agent..." progress state that internally calls onboarding then settings, not expose Meta's two-step API shape to the ops person as two wizard screens. Surfacing internal API sequencing as user-facing steps is the same anti-pattern as the UI-Skills-as-a-tab mistake, just earlier in the funnel.
- **The `followup` (inactivity re-engagement) setting as a headline feature.** It's real and missing (§ appendix), but it's a straightforward settings-tab field addition — a toggle, an interval enum, a message box, no new IA — not a "differentiator" worth a section of its own. Fix it as part of the Settings tab's existing correctness pass (it sits right next to the already-flagged `handoff.enabled` mislabeling bug), not as a vision-level initiative.

## Appendix — capability-gap research (factual, no priority judgment)

Full per-doc capability summary and confirmed-missing-in-UI list produced by direct read of all 18 `docs/meta-api/*.md` files cross-referenced against `backend/src/main/java/com/metaagent/platform/domain/` and `frontend/src/pages/` (grep-confirmed absence, not inferred):

| Doc source | Capability | Confirmed missing in |
|---|---|---|
| ui-skills.md | Rich WhatsApp components — carousel, CTA-button, flow-form, image, interactive list, location/location-request | Zero hits for `carousel`/`cta_url`/`flow_id`/`interactive_list`/`location_request`/`uiSkill` in `frontend/src`; no backend `agent-ui-skills` controller/entity |
| eligibility.md | Phone-number eligibility pre-check | No `eligibility` references frontend or backend |
| agent-onboarding.md | Async provisioning step (entities + data-prep jobs) before settings | No `agent_onboarding` references; `AgentService.createAgent()` skips straight to settings PUT |
| settings.md | `followup` inactivity re-engagement (message + interval) | No `followup` field on `Agent` entity or in frontend settings form |
| settings.md | `handoff.enabled` semantics (toggles message customization, not handoff itself) | `AgentDetailPage.tsx` mislabels toggle as gating handoff on/off — doc/UI mismatch, not just a missing feature |
| connectors.md | `/logs` stats (`include_stats`, `top_n` failure ranking) | Backend endpoint exists; no UI renders logs/stats anywhere |
| connectors.md | mTLS certificate upsert | Backend PUT endpoint exists; no certificate-upload UI field (only api-key/oauth forms) |

`thread-control.md` and `agent-test.md` are already wired end-to-end in the UI — confirmed not gaps.

Key files referenced: `docs/meta-api/*.md`; `backend/src/main/java/com/metaagent/platform/domain/agent/controller/AgentController.java`; `backend/src/main/java/com/metaagent/platform/domain/agent/entity/Agent.java`; `backend/src/main/java/com/metaagent/platform/domain/reports/controller/ReportsController.java`; `frontend/src/pages/AgentDetailPage.tsx`; `frontend/src/components/agent-detail/` (BusinessProfileTab.tsx, EvalTab.tsx, SkillsTab.tsx, SkillEditorModal.tsx, RunToolModal.tsx, TriggerEventModal.tsx, DeleteFromMetaModal.tsx).

## Status

Vision proposal only — not yet run through PM/EM/EL/UX maker-checker gates for implementation. Recommend founder review, then break into gated build tasks (§4's "no" items already give the execution-order hint: correctness/settings fixes ship first as cheap wins, IA header + Skills-format-field is the medium lift, proactive-triggers is the headline lift worth its own PM+EM gate given it's a new capability, not a fix).
