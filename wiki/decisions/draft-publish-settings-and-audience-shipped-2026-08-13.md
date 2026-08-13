---
title: Draft/Publish Shipped for Settings + Audience — 2026-08-13
tags: [decision, architecture, agent-detail, draft-publish, frontend]
date: 2026-08-13
---

# Draft/Publish Pattern — Shipped for Settings Form + Audience Toggle

Follow-up to [[draft-publish-pattern-audit-2026-08-13|the earlier audit]], which
concluded "no-go on new code this pass" and left a scoped plan. Later the
same day, on explicit founder/coordinator insistence that the task be
actually executed rather than only planned, a smaller real slice was built,
verified, and is recorded here — correcting the audit's "no code shipped"
outcome for the two pieces that were genuinely safe to land without a new
migration or backend change.

## What shipped
1. **`frontend/src/hooks/useDraftPublish.ts`** (new file) — a generic,
   reusable draft/publish hook: `useDraftPublish({ liveValue, publish,
   onPublished })` → `{ draft, setDraft, isDirty, resetDraft, publish,
   isPublishing, publishError }`. Dirty-check is `JSON.stringify` equality
   (no new dependency; matches the shapes it's used against). A draft, once
   the user has touched it, is not clobbered by a background refetch of the
   live value (tracked via ref, deliberately avoiding the stale-deps/effect
   re-fire trap already logged in `Memory/feedback_react_effect_stale_deps`
   from an earlier incident on this same page's focus-trap code).
2. **Audience toggle** (`AgentDetailPage.tsx`, `AudienceSection`) — rewired
   from an immediate `PUT /agents/:id/settings/audience` on every click to
   the shared hook: toggling now only changes local draft state, shows a
   `StatusIndicator` "Draft — not yet published" badge, and adds an explicit
   Publish / Discard draft pair. This is the hook's first real caller.
3. **Settings form** (`AgentDetailPage.tsx`, `SettingsTab`) — kept the
   existing react-hook-form `isDirty` (which already IS the correct
   draft-vs-live comparison for this tab, since nothing is written until
   submit) but added the same "Draft — not yet published" badge and
   relabelled the submit button/flash message from Save→Publish and
   Saved!→Published! to match the founder's per-tab language, per the
   explicit ask that each stage "will be in draft state" until published.

## What did NOT ship, and why (honest scope boundary)
- **No new backend endpoints, no new Flyway migration.** Both pieces above
  reuse existing `PUT /agents/:id` and `PUT /agents/:id/settings/audience` —
  the "publish" action was already correct; only the timing (immediate vs.
  on-demand) changed. A persisted draft table was considered and rejected:
  a draft is definitionally unpublished, so losing it on page refresh is
  ordinary, acceptable web-app behavior, not a bug worth a new table +
  migration for.
- **Correction (later same day, by the coordinating session):** the claim
  above — that handoffEnabled/handoffMessage are "not Meta-owned data" with
  "no matching Meta endpoint" — was wrong, and was caught by re-reading
  `AgentDeployService.java` directly rather than trusting this note.
  `putSettings`/`updateAiAudience`/`bindPhone` all read and write
  `handoff.{enabled,message}` to Meta's real `agent_config/settings`
  endpoint (settings.md) — it just was never wired to the Settings tab's
  save button. **This is exactly the gap the founder's original complaint
  was about**, and it is now fixed: `V49__add_handoff_published_at_to_agent.sql`
  adds `agent.handoff_published_at`; `AgentDeployService.publishHandoffSettings`
  (new) does the same read-modify-write as `updateAiAudience` but for
  handoff, then stamps the timestamp; `AgentController` exposes it as
  `POST /agents/{id}/settings/publish-handoff`. The Settings tab's handoff
  block now has its own "Draft — not on Meta" / "Published to Meta" badge
  (real, timestamp-backed, not the same signal as the form's local-save
  draft badge) and its own "Publish handoff to Meta" button, disabled until
  local changes are saved and a phone number is connected.
  Tone/language/behaviorRules/displayName/systemPrompt/aboutLabel remain
  correctly local-only — that part of the original claim holds; only
  handoff was misclassified.
- **Business Persona**: already fully implemented (see prior audit) — no
  action needed, untouched.
- **Skills, Connectors, Evals, Events**: still not touched. The prior
  audit's reasoning holds — Skills/Connectors already have an
  attach/detach-is-the-publish library pattern that needs an explicit
  founder decision before any further draft layer is added on top, and
  Evals/Events' data models were not read deeply enough in either pass to
  commit to a design. Retrofitting `useDraftPublish` onto them is real,
  scoped, follow-up work, not started here.
- **FAQ / Websites / Files**: explicitly out of scope, PM call — these are
  list-add/delete flows, not single-form edits; "draft a delete" doesn't
  have an obvious UI meaning, and the founder didn't name these tabs.

## Verification
Re-run after the handoff correction above (backend files were touched this time):
- `npx tsc --noEmit` (frontend) — exit 0, no errors.
- `mvn -q -o compile` (backend) — exit 0, no output (clean).

## Files (final, including the handoff correction)
- `backend/src/main/resources/db/migration/V49__add_handoff_published_at_to_agent.sql` (new)
- `backend/src/main/java/com/metaagent/platform/domain/agent/entity/Agent.java` — `handoffPublishedAt` field
- `backend/src/main/java/com/metaagent/platform/domain/agent/service/AgentDeployService.java` — `publishHandoffSettings`
- `backend/src/main/java/com/metaagent/platform/domain/agent/controller/AgentController.java` — `POST /agents/{id}/settings/publish-handoff`
- `frontend/src/hooks/useDraftPublish.ts` (new)
- `frontend/src/pages/AgentDetailPage.tsx` — `AgentApi.handoffPublishedAt`, `AudienceSection` on the shared hook, `SettingsTab`'s Publish relabel + handoff-specific draft badge/publish button

## Related
- [[draft-publish-pattern-audit-2026-08-13|Draft/Publish Pattern Audit Across Agent Detail Tabs]] — the audit and scoped plan this follows up on
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
- [[../bugs-violations/connector-creation-never-succeeds-2026-08-13|Connector creation never succeeds]] — pre-existing, unrelated, not touched by this work; Connectors tab was explicitly deferred, not retried against this bug
