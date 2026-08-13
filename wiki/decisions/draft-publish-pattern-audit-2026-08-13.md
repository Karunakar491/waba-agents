---
title: Draft/Publish Pattern Audit Across Agent Detail Tabs — 2026-08-13
tags: [decision, architecture, agent-detail, draft-publish, scope]
date: 2026-08-13
---

# Draft/Publish Pattern Audit Across Agent Detail Tabs

## The ask (founder, verbatim)
"Every stage can have its push button. If its not published it will be in draft state." Per-tab, not global: each of Business Persona, Skills, Settings, Connectors, Evals, Events should (1) pull live state from Meta on load, (2) let edits sit as local draft only, (3) show a per-tab draft indicator when draft != live, (4) have its own Publish button that pushes only that tab's draft to Meta + DB.

## PM perspective
The instinct — "make every tab a draft/publish cycle" — is right for tabs where a bad edit reaching Meta live is costly (Business Persona, Settings, Skills content). It's the wrong mental model for tabs that are already inherently transactional: Connectors/Tools create-or-delete *is* the action, there's no meaningful "draft" state between "I typed a URL" and "it's live" the way there is for a paragraph of business copy — Meta itself has no draft connector concept. Evals and Events are read/trigger surfaces, not editable state with a Meta-side live counterpart to diff against. Forcing all six into one draft/publish shape would be over-scoping into artifice for tabs that don't need it. PM position: honor the founder's instruction to the letter for tabs where "live Meta state to diff against" genuinely exists (Business Persona, Settings), and flag the mismatch explicitly for the others rather than force a fake diff.

## EM perspective
Verified against the actual codebase rather than assuming a blank slate:
- **Business Persona already fully implements this exact pattern**, built earlier this same session (2026-08-13) under the "reusable library" work: `BusinessProfileController` (`GET /business-profiles/live`, `/drafts`, `POST /draft`, `PUT /draft/{id}`, `POST /draft/{id}/deploy`) and `BusinessProfileTab.tsx` (live query, drafts list, deploy mutation, live-status card). This is not a coincidence — Business Persona was the domain that got the definition/deployment split in this session. No new work needed here; it's a reference implementation, not a gap.
- **Settings tab** (tone/language/behaviorRules/handoffEnabled/handoffMessage/displayName/systemPrompt, `AgentDetailPage.tsx` ~1761-2178) has no live-Meta pull and no draft/publish split — it's a single `PUT /agents/:id` on submit, applied immediately. This is the real gap matching the founder's ask literally.
- **Skills tab** already follows the three-layer library pattern (`skill` definition / `agent_skill_attachment` deployment) documented in `wiki/decisions/reusable-library-over-meta-execution-2026-08-13.md` — attaching a skill to an agent is itself the "publish" action; editing a skill's own definition already happens in the Skill Library, off this page. Whether it needs its own additional per-tab draft affordance on *this* page is a real open design question, not answered by re-reading code alone.
- **Connectors tab** — same library pattern, extended to Connectors this session (`connector` / `connector_deployment` / `agent_connector` mirror). Create/delete against Meta happen immediately; no draft concept exists on the Meta side for a connector.
- **Evals, Events** — not found as dedicated backend domains with editable persisted state in this codebase pass; Events is a one-shot trigger action (`TriggerEventModal`), Evals tab exists as a component (`EvalTab.tsx`) but wasn't read in enough depth this pass to state its data model with confidence.
EM position: implementing full draft/publish for Settings is a clean, scoped, additive piece of work (new `PUT /agents/:id/draft` + `POST /agents/:id/publish-settings` style split, or reuse the BusinessProfile draft-row pattern against a new `agent_settings_draft` table) — but it is itself a >3-file, >400-line change once done properly (new migration, new entity/repo/service/controller, new frontend hook + tab rewiring) and requires its own Plan-First artifact and full PM→EM→Worker→EL→QA gate sequence, not a same-session bolt-on. Skills/Connectors need a founder decision first on whether attach/detach-is-the-draft is sufficient or whether a further draft layer is wanted — building ahead of that answer risks the over-scoping PM flagged above. Evals/Events need their actual data model read before any design commitment.

## Go/no-go decision (this task)
**No-go on implementing new code this pass.** Reasoning, stated plainly: this task's real scope — live-pull + draft/publish + per-tab indicator across 5 tabs not already covered, with new backend endpoints, a new additive migration, a shared frontend hook, and full gate review — exceeds what can be honestly built and gated (PM/EM/EL/QA, Plan-First, diff-size-limited chunks) inside one pass without either skipping CLAUDE.md's process or fabricating completion. Given the direct conflict between "ship all six tabs now" and "never skip a gate, never claim done without verification," CLAUDE.md is explicit: the task is delayed, not the rule.

## What this pass actually delivered
1. This audit — the real starting state, tab by tab, verified by reading code, not assumed.
2. Confirmation Business Persona is **done**, no action needed.
3. A scoped follow-up plan (below) so the next pass isn't starting from zero.

## Scoped plan for the next pass
1. **Settings tab** (highest-value gap, most literal match to the founder's ask): new `agent_settings_draft` table (additive migration, next V-number after whatever is latest at build time), draft CRUD + `GET live` (already live — Settings fields ARE the live agent row, so "live" pull is just the existing `GET /agents/:id`) + `POST publish` endpoint that applies the draft to the real `agent` row and triggers the same Meta-side calls Persona/Skills already trigger where applicable (handoff/tone/language are DB-only today — confirm with founder whether these are meant to reach Meta at all, since Meta's Business Messaging API has no generic "tone" field; may be agent-behavior-only, not Meta-syncable, which would make "publish to Meta" a misnomer for this tab specifically).
2. **Shared hook**: `useDraftPublish<T>({ liveQueryKey, liveFn, draftQueryKey, draftFn, publishFn })` extracted once Settings is built for real, then retrofitted onto Business Persona's existing (already-correct) implementation for consistency — not built speculatively before a second real caller exists, per CLAUDE.md's "no abstraction until three concrete cases."
3. **Skills/Connectors**: bring back to founder for a explicit decision — is attach/detach-as-publish sufficient, or is a further draft layer wanted on top of the already-shipped library pattern — before writing any code.
4. **Evals/Events**: read `EvalTab.tsx` and the events backend fully before any design commitment; do not assume they need this pattern at all.
5. Each of the above gets its own Plan-First artifact and full gate sequence when picked up.

## Related
- [[reusable-library-over-meta-execution-2026-08-13|Reusable library over Meta execution]]
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
