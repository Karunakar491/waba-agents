# IA Revision — Module-by-Module — 2026-07-22

**Supersedes the nav structure in `docs/specs/2026-07-18-product-design.md` §nav.** Source: founder's 5-module vision, reconciled against actual codebase state and the [2026-07-22 world-class audit](2026-07-22-world-class-audit.md).

Founder's core correction to the earlier audit: this reprioritizes Test Agent, webhook visibility, conversation rendering, and thread control/handover *above* the client-switcher work — those are the real P0 gaps, not the client entity (which is still real, just sequenced later, and lives in module 5).

---

## 1. Dashboard

**Vision:** Landing module.
**Reality:** Today this route is a literal `<Navigate to="/agents" />` — not thin, non-existent.
**Open question (unresolved):** if Agents (module 2) already lists every agent with health/status, what does Dashboard show that isn't redundant?
**PM suggestion:** give Dashboard a job Agents can't do — cross-client/cross-agent *attention triage*. Not another list, a "what needs you right now" surface: failed deploys, conversations stuck/escalated, WABA health degraded, credit line issues, agents left in draft — pulled from every client, ranked by urgency. This is also where the portfolio-view gap from the original audit (finding #1) gets solved without inventing a second screen for it.

## 2. Agents

**Vision:** List (name, WABA ID, phone number ID, conversations started, health) + create wizard (basic details → choose from existing connectors/skills/KBs/FAQs or create new) + per-agent Edit and Test actions.
**Reality:** List shows name, phone number ID, and status only — no WABA ID, no conversation count, no health. Wizard exists but builds skills/FAQs/KB inline, agent-scoped (see module 3 conflict). No Test action exists anywhere, frontend or backend, despite Meta's test API being documented.
**Gaps to build:** 3 new list columns; Test Agent end-to-end (highest-severity open item from the original audit).
**PM suggestions:**
- Define "health" concretely before building the column — is it Meta's phone number quality rating, delivery error rate, webhook lag, or a composite? An undefined health signal is worse than no signal — it teaches operators to ignore it.
- Test shouldn't be pre-deploy-only. If an operator edits FAQs on an already-live agent (open question from the client-switcher discussion, still unresolved), Test needs to be re-runnable against the draft change before it goes live, not just a first-deploy gate.
- Given operators build similar agents across multiple clients, a "duplicate from existing agent" action on this list would cut wizard time significantly for anyone past their first build (Design Evaluator's finding — the wizard's onboarding cadence has no expert path).

## 3. Connectors, Skills, Knowledge Bases, FAQs (consolidated, WABA-level)

**Vision:** One library per WABA. Build once, reuse across every agent under that WABA — appears as a pick-from-existing option inside the agent wizard instead of being rebuilt per agent.
**Reality:** None of this exists as a shared resource. Every connector/skill/FAQ/KB entry is created inline inside the Create Agent wizard, owned by that one agent.
**⚠️ Flagged for EM before any frontend work starts:** this is a data-model change, not a UI change. Moving from agent-owned to WABA-shared resources raises real questions: if an operator edits a shared FAQ, does every agent using it update live immediately, or fork a version at time of use? Is there a "used by N agents" warning before a shared edit? This needs a schema decision (and likely migration path for anything already built agent-scoped) before the library UI is designed.
**PM suggestions:**
- Whatever the versioning answer, put an audit trail on shared-resource edits from day one — once something is shared across agents, "who changed this and when" stops being optional (same audit-trail need flagged for the client entity — likely one shared mechanism, not two).
- The library will need search/tag/filter as it grows past a handful of items per WABA — don't ship it as an unsorted flat list; that's a guaranteed rebuild once a WABA has 30+ FAQs.

## 4. Chat Conversation (webhook-rendered, read-only)

**Vision:** Compile received webhooks into a conversation-style render. No user input — this is a viewer, not a chat client.
**Reality:** Closest to already-built — Inbox exists today with this same read-only intent, just under-scoped ("audit log," no filters).
**⚠️ Unresolved contradiction, needs founder's call:** thread control (module linked to Human Handover) requires the operator to *send a message* to take control of a conversation. If module 4 is strictly render-only, where does that send-a-message action live? Two options:
  - (a) Takeover/Release is a distinct control bolted onto this same screen — clearly a control, not a chat input, sitting in the conversation header, not the message stream.
  - (b) Takeover lives outside module 4 entirely (e.g., triggered from the Agents module or its own surface), and module 4 stays purely passive.
**PM suggestion:** option (a) is almost certainly right — an operator watching a conversation who spots the moment it needs a human shouldn't have to leave the screen to act on it. But it should be visually unmistakable as a mode-switch (e.g., a banner: "You are now controlling this conversation" once taken over), not a message box that looks like normal chat.
- Needs filters (by agent, by client, by status) and a visual distinction between AI-handled and human-controlled segments within a single thread, so the handoff moment is visible in context, not just implied.

## 5. Profile → Customer section + per-phone-number business profile

**Vision:** Client management under Profile — client name/WABA, connection status, credit line status, phone numbers and health. Per-phone-number detail: what the business does, other context.
**Reality:** This is the Client entity from the earlier client-switcher discussion — confirmed as a real DB table (not a view), since Meta API calls key off it. Settings/Profile today is otherwise mostly stubbed, including fabricated plan/billing UI that should be removed regardless of this rework.
**PM suggestion:** wire the attention-badge concept from the client-switcher discussion directly into this list (WABA disconnected, credit line issue, phone health degraded — visible without opening the client). Same entity should back both this management view and the global client-switcher control — one data source, two surfaces, not two separate things to keep in sync.

---

## Sequencing implication

This reorders the original audit's priority stack. Updated view:
1. Test Agent (module 2) — highest-severity, smallest bounded scope, Meta API already documented.
2. Chat Conversation webhook rendering + Thread Control/Takeover (module 4) — HIGH severity per the architecture doc's own risk register (R2); currently a stub page (`HumanHandoverPage.tsx`) with zero backend.
3. Connectors/Skills/KB/FAQ library (module 3) — needs EM schema decision before frontend starts.
4. Client entity + Profile/Customer section + Dashboard triage view (modules 1 & 5) — real, but behind 1–3.

Webhook secret fail-fast fix (security finding from the original audit) remains independent of this sequencing — should happen regardless of which module ships next.
