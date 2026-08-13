---
title: Eight Critical Internal-Feedback Items — 2026-08-13
tags: [decision, webhooks, api-calls, conversations, agents-list, draft-publish, critical]
date: 2026-08-13
---

# Eight Critical Internal-Feedback Items

Founder relayed "critical feedback from internal teams" as an 8-item list, framed as blocking the product's viability. Each item verified against the real code before building anything (per the day's own earlier lesson about trusting claims over code) — several turned out to already be solved, one turned out to be a genuinely serious data-loss bug.

## 1. "Log all webhooks you send to Meta, including ones not from the UI"
**Already true — no code change.** `MetaApiClient.timed()` logs every outbound call unconditionally via the async `ApiCallLogWriter`, and `tryGetAccountId()` falls back to `BackgroundCallContext` for scheduled/background threads. `GlobalSyncScheduler`'s own class-level javadoc documents this exact gap being found and fixed on 2026-08-03 ("confirmed live that background-thread calls were landing in the audit table correctly but invisible on any account's own Reports > API Calls page"). Re-verified by reading the code directly rather than assuming a blank slate.

## 2. API section needs a filter (endpoint, method, phone number, agent id)
Extended the existing API Calls filter bar (built 2026-08-13 earlier the same day): added `phoneNumberId` and `agentId` to `ApiCallLogFilter`. Both are now columns on `api_call_log` (`V51`), populated at write time in `ApiCallLogWriter` — phone number via a regex on the call path's first segment, agent id via an `AgentRepository` lookup (this app's internal id, not Meta's own `agent_id`, which is a different identifier). Frontend gets two new inputs alongside the existing path/method/outcome/date filters.

## 3 & 6. Log and filter ALL kinds of webhooks, every one
Real gap, now fixed: `WebhookController` used to silently drop (never persist) any payload it couldn't attribute to a known agent, or that failed signature verification — both cases had no known `accountId`, and `webhook_raw.account_id` was `NOT NULL`, so there was no way to persist them even if it wanted to. `V50` relaxes that constraint and adds `phone_number_id`. The controller now persists every payload (status `FAILED` with a reason for the unattributable/signature-failed cases, never queued for processing since nothing downstream knows the tenant). The Inbox's existing Webhooks panel gets real filters (phone number, agent id, status, date range) via a new `WebhookRawFilter` + `Specification`, matching the API Calls pattern. Unattributed rows (no tenant) are visible to every authenticated account, not hidden — excluding them would recreate the exact "logged but nobody can see it" problem this fix exists to solve.

## 4. "When a user logs in, all webhooks related to the WABA should be displayed"
Founder explicitly chose a literal on-login redirect over a passive default view. Implemented via a `postLogin` router state flag set only by `useLogin`'s `navigate('/', { state: { postLogin: true } })` — never by a bookmark/refresh landing on `/`. `RootRedirect` (and `ModuleSelectorPage` for the currently-unused multi-module case) checks that flag and, only right after a real login, sends the operator to `/inbox?view=webhooks` instead of the module's normal home route. Deliberately not a hardcoded change to `MODULE_HOME_ROUTE` itself — that would silently change every later visit to `/`, not just the moment after signing in, and would undo the 2026-08-04 fix that made `/` resolve module destination correctly in the first place.

## 5. "With 7-8 phone numbers, how do I know which number a conversation pinged?"
Real gap: `Conversation` has no phone number field of its own (only `agentId`; the customer's own number is `externalId`). Fixed by resolving the owning agent's number, batched across the page (not N+1) in `ConversationController`, via a new `ConversationListItem` wrapper (`@JsonUnwrapped` conversation + `displayPhoneNumber` + `agentDisplayName`). Shown in the Inbox's conversation list rows and the open-thread header as "to {number}".

## 7. Agents list: Agent column, About column, Health column
Three real, founder-verified gaps in `AgentsPage.tsx`:
- **Agent column**: a Meta-imported agent's placeholder name relied on an automatic Meta-name-resolution retry that often never resolves anything real (the actual complaint — the column looked broken because it stayed permanently stuck showing "Imported agent (...)"). Replaced with a direct "Add a label" affordance — types the real name straight into our own DB via the existing `PUT /agents/:id`. The old `refresh-name` endpoint is untouched, just no longer called from this screen.
- **About column**: used to be a manually-typed free-text field (`aboutLabel`) with no connection to the agent's actual persona. Now sourced from the real deployed Business Persona's `businessDescription` for that agent's phone number (`BusinessProfile`, status `DEPLOYED`) — a dash when none has ever been deployed, not a manual-entry prompt (that would just recreate the same disconnected-text problem).
- **Health column removed, Agent ID column added**: Health (healthy/needs attention/inactive) duplicated the Enabled toggle + status badge with no new information, while the id operators actually need for the new API Calls/Webhooks filters (item 2/6) was nowhere on this screen. Agent ID now shown with a copy button.

## 8. "See what's published to Meta, edit, and republish" — every tab
Founder's explicit answer when asked to scope this: extend the draft/publish pattern to **every** tab (Settings/Persona already done earlier the same day; this covers Skills, Connectors, Evals, Events). Verified each tab's actual shape before building anything, rather than forcing one UI pattern onto all of them:
- **Skills**: already has a real draft-vs-publish split, just unlabeled. `SkillEditorModal` has two genuinely different save paths — a Library-attached skill's save (`PUT /skills/:id`) never touches Meta at all (a real draft), while the legacy agent-scoped path (`PUT /agents/:id/skills/:id`) writes to Meta immediately. Relabeled the submit button to say which one it actually is: "Save draft" for the Library path, "Publish skill"/"Publish changes" for the legacy path. No fake unified label that would be accurate for neither case.
- **Connectors**: `AddConnectorModal`'s submit is always an immediate Meta write (no Meta-side draft-connector concept exists) — relabeled "Add"/"Save changes" to "Publish connector"/"Publish changes" to say what it actually does, with an inline note pointing at the pre-existing, already-escalated [[../bugs-violations/connector-creation-never-succeeds-2026-08-13|connector-creation-never-succeeds bug]] (creation fails against real Meta regardless of payload — not something this label change fixes or should pretend to fix).
- **Evals, Events**: read the actual components (`EvalTab.tsx`, `TriggerEventModal.tsx`) before deciding anything. Both are one-shot action triggers with no persisted, editable agent configuration at all — Evals runs a test suite and polls for results; Events fires a single business event at Meta. There is no "live Meta state" to pull, edit, or republish for either — forcing a Draft/Publish badge onto a stateless action button would be decorative UI, not a real fix, and was deliberately not built. This is the honest scope boundary for item 8, not a silently dropped requirement.

## Verification
- `mvn -q -o compile` (backend) — clean, no output, twice more after later edits.
- `npm run build` (frontend, full `tsc -b && vite build`, not just `tsc --noEmit`) — caught one real dead import (`StatusIndicator`/`StatusTone`, orphaned by the Health column removal) that `tsc --noEmit` alone had missed; fixed, then clean build.
- Migrations: `V50` (webhook_raw), `V51` (api_call_log) — both additive/widening only, no column drops or renames.

## Related
- [[draft-publish-settings-and-audience-shipped-2026-08-13|Draft/Publish for Settings + Audience]] — same day, earlier; item 8 builds directly on this
- [[../bugs-violations/bizai-active-messages-never-persisted-2026-08-13|BizAI-active messages never persisted]] — the live debugging session immediately before this list was raised
- [[../bugs-violations/connector-creation-never-succeeds-2026-08-13|Connector creation never succeeds]] — referenced, not re-investigated, by item 8's Connectors relabel
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
