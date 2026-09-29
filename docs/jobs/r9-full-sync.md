# R9 — full sync, slice plan

## Job

Who opens this: whoever picks up R9 next. What they decide: which slice to
build next. What they see: what's actually live vs. not started, and the
real evidence each slice works against a live agent.

Story/AC: `docs/user-stories/R9-full-sync-and-meta-parity.md`. Founder read
stages 2-4 and said proceed, 2026-09-29.

## Proof

Deployed 2026-09-29 10:01 UTC to production (V66 migration, jar md5
`75e82ca7aa4ef85b01fc6c556616a171`, built from the exact commit already
running — class-list diff showed only the new R9 classes added, nothing
removed). DB backup taken immediately before:
`/opt/metaagent/db-backups/pre-V66-20260929T095742Z.sql` (43 tables, verified
non-truncated). Rollback jar: `/opt/metaagent/rollback-preR9-20260929T095809Z-platform.jar`.

Verified against real Meta via a real login (`node scripts/meta-check.js`,
account `demo@karix.online`) — the login trigger fired for all 16 of that
account's agents, 48 `agent_sync_log` rows, **all SUCCESS, zero FAILED**.
The live Astrotalk agent (`888030775306358784`, phone `916330094906604`,
active, real customer traffic) synced clean across all 6 categories, with
BUSINESS_PERSONA and WEBSITES both showing `changed=1` — real drift found
and overwritten from Meta, not a no-op. 11 skills and 6 FAQs now mirror
Meta's live values for that agent. App health check 200 after restart,
no new errors in `app.log` beyond the expected shutdown noise from the old
process exiting. This satisfies R9 test case 1 (an agent with existing Meta
config syncs to match) for skills/FAQs/files/websites/connectors/persona,
though not yet test cases 2/3/6 (edit-on-Meta-then-resync, daily-without-login,
delete-on-Meta) — those need a longer observation window or a deliberate
Meta-side edit, not run yet.

**Slices 3 and 4 (settings, evals, insights) followed on 2026-09-29 11:42
UTC** — see their own sections below for proof. All nine categories now sync
on phone-add/login/daily. Only slice 5 (a screen showing any of this) is
left.

R9 asks for three triggers (phone-add, login, daily) × everything Meta has
(skills, connectors, FAQs, files, websites, persona, settings, event history,
evals, insights), Meta always wins. That's too large for one diff under the
400-line commit gate, and each data type needs its own real-Meta proof — so
it ships in slices, same as R4-R6.

## Slice 1 — phone-add trigger, the categories with an existing entity to sync into

**Live 2026-09-29 10:01 UTC.** Verified via the login path (slice 2 fires the
same `AccountSyncService.syncAgent` call slice 1 does) against the real,
active Astrotalk agent — see this file's Proof section. The phone-add call
sites themselves (`WabaAgentReconciliationService.reconcileOne`,
`AgentService.bindPhone`) haven't individually fired in production yet since
no phone number has been added or rebound since deploy — same underlying
method, so this is a real but incomplete proof (see Proof section's note on
which test cases remain).

- `AgentSyncLog` (V66 migration) — append-only, one row per (agent, category,
  attempt): trigger, status, changed, error. This is what AC#4/#9/#10 ("when
  was it last checked", "did it find drift", "which categories failed") read
  from. No API endpoint exposes it yet — that's frontend work, not started.
- `AccountSyncService.syncAgent(agent, accountId, trigger)` — six categories,
  each independently try/caught (AC#10): Skills, FAQs, Files, Websites,
  Connectors (reuses the existing `ConnectorMirrorService`, doesn't
  reimplement it), Business Persona (new — no fetch-from-Meta path existed
  before this). Each does a real overwrite of Meta-owned fields on every
  matching row (AC#7, "Meta wins"), not the old backfill-only /
  presence-flag-only pattern `MetaMirrorReconciler` used — that pattern left
  existing rows' *content* untouched even when Meta's had changed, which
  fails AC#7 outright. Also deletes local rows whose Meta id has vanished
  from Meta's list (AC test case 6).
- Wired into the two places a phone number actually gets attached to an
  agent: `WabaAgentReconciliationService.reconcileOne` (an agent already live
  on Meta, discovered on our side for the first time — the literal Q5
  scenario) and `AgentService.bindPhone` (an operator binds a number to an
  agent built in our wizard).

**Known gaps in this slice, deliberately deferred:**

- AC#8's "what Meta's value was before the overwrite" — `changed` (boolean)
  is logged, the actual before-value is not yet written to
  `AgentSyncLog.beforeSnapshot` (column exists, unused). Small follow-up once
  slice 1 is proven — didn't want to guess a serialization shape before a
  real payload confirms the fields.
- Settings (AC#5) is not in this slice. `AgentService.bindPhone` already
  hydrates handoff fields once, and `AgentService.reconcileStatus` already
  does a full-overwrite for on/off — a settings category can mostly reuse
  those, but wasn't folded in here to keep slice 1's diff reviewable.

## Slice 2 — login + daily triggers

**Live 2026-09-29 10:01 UTC.** The login trigger fired for real
(`demo@karix.online` via `scripts/meta-check.js`) — see Proof section. The
daily tier-3 job (03:00 cron) hasn't fired yet since deploy; its own
correctness rests on reusing the identical `AccountSyncService.syncAgent`
call the now-proven login path uses, just from a different caller.

Both reuse `AccountSyncService.syncAgent` unchanged (a caller problem, not a
sync-logic one) and both reuse existing infrastructure rather than building
new fan-out:

- **Login** — `AgentDetailSyncService.syncForAccount` already ran at login
  (`SecurityService.login()` fires it `@Async`, fire-and-forget) for the
  older, narrower MetaMirrorReconciler backfill. It now also calls
  `AccountSyncService.syncAgent(..., LOGIN)` per agent in the same parallel
  loop (`syncAgentsInParallel`), so login gained R9's full sync without a
  second fan-out or a second Meta-call burst.
- **Daily** — new `GlobalSyncScheduler.syncAccountWide()`, tier 3, cron
  `0 0 3 * * *` (03:00, off-peak). Deliberately **sequential**, not the
  parallel executor tier-2 uses — R9's own edge-case list names "a login
  sync for an account with dozens of agents fires dozens of calls at once"
  as a rate-limit risk; tier 3 can touch every agent on every account in one
  run, so it trades wall-clock time for never bursting Meta. Same dedupe as
  tier 2 (`collectDistinctAccessibleAgents` — one agent synced once even if
  several accounts share its WABA).
- Tier 2 (existing hourly MetaMirrorReconciler job) explicitly does **not**
  also fire `AccountSyncService.syncAgent` — R9 asks for daily, not hourly,
  and tagging an hourly run "DAILY" in `AgentSyncLog` would be dishonest on
  screen once slice 5 renders it. `syncAgentsInParallel` takes a nullable
  `trigger`; tier 2 passes `null` and skips the R9 call entirely.

**Not yet built:** the phone-add trigger (slice 1) still doesn't dedupe
against a login/daily sync that might already be in flight for the same
agent — low risk (idempotent overwrite either way) but worth noting before
scale.

## Slice 3 — settings

**Live 2026-09-29 11:42 UTC.** V67 adds columns to `agent` for the four
settings fields that never had anywhere to live before — `ai_audience`,
`followup_enabled`/`followup_message`, `never_say_phrases` (JSON), and
`allowlist_snapshot` (JSON, read-only mirror — no local editor exists or is
planned for this, per R9's own out-of-scope note). Handoff is also fully
overwritten here now (was previously only hydrated when locally empty, at
bind time). Deliberately does **not** touch `rollout.enabled`/`status` —
`AgentService.reconcileStatus` already does a correct, TTL-gated Meta-wins
overwrite of those; adding a second path would double the Meta calls for
the same field.

Verified against the live Astrotalk agent: `ai_audience=EVERYONE`,
`followup_enabled=1`, `handoff_enabled=1`, and a real allowlist snapshot
with real `pfbid…` entries, all pulled from Meta on a real login.

## Slice 4 — evals + insights

**Live 2026-09-29 11:42 UTC.** V68 adds `agent_eval_case` (mirrors Meta's
`agent-eval/cases` — case *configurations* only; Meta has no "list all past
runs" endpoint, only single-job-id polling, so eval *results* genuinely
can't be passively synced, only definitions) and `agent_insights_snapshot`
(one row per agent, overwritten each sync, from three independent Meta
endpoints: `insights/conversations`, `insights/tool_calls`,
`insights/agent_events`).

Verified against the live Astrotalk agent: **126 real eval case
configurations** synced, and real insight numbers — `ai_handoffs=4` (Meta's
own live queue-depth count), and a real tool row for
`astrotalk_kundli_api__general_kundli` with a real call count. **Known gap:**
`ai_threads` came back null for Astrotalk despite `ai_handoffs` succeeding on
the same call — likely the repeated `metrics=` query param needs different
encoding for that specific field; not chased further since nothing renders
this yet and the rest of the row is genuinely populated. Entity scoping
(`phoneNumberId` + `?agent_id=`) followed this codebase's existing
convention rather than a documented "entity_id" semantic — proven correct
by zero failures across all 8 phone-bound agents, not by spec-reading.

## Slice 5 — what he sees

Not built. Agreed with the founder 2026-09-29, three pieces:

1. **Sync status, on the agent's own page.** A quiet status line near the
   existing Active/Paused pill: `Synced with Meta · 2 min ago`, reading
   `AgentSyncLog`'s newest row per category for this agent. Click it and a
   panel drops down listing all 9 categories, each with its own last-synced
   time and a quiet "Updated from Meta" tag on the ones where `changed=true`.
   A failed category shows a plain-language reason, same tone as the
   existing "Blocked by Meta" skill badge — never Meta's raw error text.
   Nothing permanent added to the tab bar; this is collapsed by default so
   it doesn't compete with the tabs that are already there.
2. **A third Reports tab, "Insights."** `ReportsPage.tsx` already has
   Conversations and Eval as account-wide tabs (`frontend/src/pages/ReportsPage.tsx`).
   Insights joins them: one row per agent, reading `agent_insights_snapshot`
   directly — no live Meta call on page load, since the sync already did
   that work. Columns: live queue depth (`ai_handoffs`), and per-tool health
   (call count, success/error rate) from `tool_call_insights`.
3. **`ai_handoffs` promoted onto the agent's own page too**, not just
   Reports — a small number badge ("4 waiting on you") near the top.
   STATE.md's top open issue is "no conversation ever closes, no notion of
   a queue"; this is Meta's own live count of exactly that, already synced,
   currently shown nowhere. Higher priority than the Insights tab itself —
   build this half even if the full tab waits.

Eval cases get no new screen — folded into the existing Eval tab
(`EvalRollup` in `ReportsPage.tsx`) as a small "N cases configured" line per
agent, reading `agent_eval_case`. Running an eval is still its own deliberate
action (`EvalRollupWorker`); this only shows what's configured to run.

Depends on slices 1-4 having real proof they work, not just compiling — see
each slice's own Proof/verification note above.

## Verification still owed before slice 1 can be called done

1. Real bind against `+91 90100 11634` where the Meta-side agent already has
   a skill/FAQ/file/website/persona field we don't have locally — confirm it
   appears in our DB matching Meta exactly (test case 1).
2. Change something directly in Meta's own interface, re-trigger a bind or
   reconciliation, confirm our screen (once slice 5 exists) or the DB
   directly shows Meta's version (test case 2).
3. Delete a skill directly on Meta, re-sync, confirm it's gone locally (test
   case 6).
